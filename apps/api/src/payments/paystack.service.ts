import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../database/database.service';

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    id: number;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    channel?: string;
    paid_at?: string;
    metadata?: Record<string, unknown>;
    customer?: {
      email?: string;
      customer_code?: string;
    };
  };
};

@Injectable()
export class PaystackService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client.orm.public;
  }

  private get secretKey() {
    const key = process.env.PAYSTACK_SECRET_KEY;

    if (!key) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

    return key;
  }

  private async paystackRequest<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
    } = {},
  ): Promise<T> {
    const response = await fetch(`https://api.paystack.co${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
    });

    const payload = (await response.json()) as T;

    if (!response.ok) {
      throw new BadRequestException(
        `Paystack request failed with HTTP ${response.status}`,
      );
    }

    return payload;
  }

  private amountToSubunit(amount: number, currency: string) {
    const zeroDecimalCurrencies = new Set([
      'JPY',
      'KRW',
      'VND',
    ]);

    if (zeroDecimalCurrencies.has(currency.toUpperCase())) {
      return Math.round(amount);
    }

    return Math.round(amount * 100);
  }

  async initializePayment(token: string) {
    const paymentLink = await this.db.PaymentLink.where({
      token,
    }).first();

    if (!paymentLink) {
      throw new NotFoundException('Payment link not found');
    }

    if (paymentLink.status !== 'ACTIVE') {
      throw new BadRequestException('Payment link is not active');
    }

    if (
      paymentLink.expiresAt &&
      new Date(paymentLink.expiresAt).getTime() <= Date.now()
    ) {
      throw new BadRequestException('Payment link has expired');
    }

    const invoice = await this.db.Invoice.where({
      id: paymentLink.invoiceId,
      businessId: paymentLink.businessId,
    }).first();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const customer = await this.db.Customer.where({
      id: invoice.customerId,
      businessId: paymentLink.businessId,
    }).first();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const remaining =
      Number(invoice.totalAmount) - Number(invoice.amountPaid);

    if (remaining <= 0) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    const currency = String(invoice.currency).toUpperCase();

    if (!['NGN', 'GHS', 'ZAR', 'KES', 'USD'].includes(currency)) {
      throw new BadRequestException(
        `Paystack payment is not configured for currency ${currency}`,
      );
    }

    const internalReference =
      `BP-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;

    const callbackUrl =
      process.env.PAYSTACK_CALLBACK_URL ??
      'http://localhost:3000/payment/callback';

    const result = await this.paystackRequest<PaystackInitializeResponse>(
      '/transaction/initialize',
      {
        method: 'POST',
        body: {
          email: customer.email,
          amount: this.amountToSubunit(remaining, currency),
          currency,
          reference: internalReference,
          callback_url: callbackUrl,
          metadata: {
            businessId: paymentLink.businessId,
            invoiceId: invoice.id,
            paymentLinkId: paymentLink.id,
            internalReference,
          },
        },
      },
    );

    if (!result.status || !result.data) {
      throw new BadRequestException(
        result.message || 'Paystack could not initialize the transaction',
      );
    }

    return {
      authorization_url: result.data.authorization_url,
      access_code: result.data.access_code,
      reference: result.data.reference,
      internalReference,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: remaining,
        currency,
      },
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined) {
    if (!signature) {
      return false;
    }

    const expected = createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');

    const receivedBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
  }

  async verifyTransaction(reference: string) {
    return this.paystackRequest<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
  }

  async processWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid Paystack webhook signature');
    }

    let payload: any;

    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const eventType = String(payload?.event ?? '');
    const data = payload?.data;

    if (!data) {
      throw new BadRequestException('Paystack webhook data is missing');
    }

    const metadata =
      data.metadata && typeof data.metadata === 'object'
        ? data.metadata
        : {};

    const businessId = String(metadata.businessId ?? '');

    if (!businessId) {
      throw new BadRequestException(
        'Paystack webhook metadata is missing businessId',
      );
    }

    const eventId = String(data.id ?? data.reference ?? '');

    if (!eventId) {
      throw new BadRequestException(
        'Paystack webhook is missing a transaction identifier',
      );
    }

    const existingEvent = await this.db.ProviderEvent.where({
      provider: 'PAYSTACK',
      eventId,
    }).first();

    if (existingEvent) {
      return {
        received: true,
        duplicate: true,
        eventType,
        eventId,
      };
    }

    const providerEvent = await this.db.ProviderEvent.create({
      businessId,
      provider: 'PAYSTACK',
      eventId,
      eventType,
      status: 'RECEIVED',
      payload,
    });

    if (eventType !== 'charge.success') {
      await this.db.ProviderEvent
        .where({ id: providerEvent.id })
        .update({
          status: 'PROCESSED',
          processedAt: new Date().toISOString(),
        });

      return {
        received: true,
        processed: false,
        eventType,
        eventId,
      };
    }

    const reference = String(data.reference ?? '');

    if (!reference) {
      throw new BadRequestException(
        'Paystack charge.success is missing reference',
      );
    }

    const verified = await this.verifyTransaction(reference);

    if (!verified.status || !verified.data) {
      throw new BadRequestException(
        'Paystack transaction verification failed',
      );
    }

    const transaction = verified.data;

    if (transaction.status !== 'success') {
      await this.db.ProviderEvent
        .where({ id: providerEvent.id })
        .update({
          status: 'PROCESSED',
          processedAt: new Date().toISOString(),
        });

      return {
        received: true,
        processed: false,
        eventType,
        eventId,
        transactionStatus: transaction.status,
      };
    }

    const invoiceId = String(metadata.invoiceId ?? '');
    const paymentLinkId = String(metadata.paymentLinkId ?? '');

    if (!invoiceId) {
      throw new BadRequestException(
        'Paystack transaction metadata is missing invoiceId',
      );
    }

    const invoice = await this.db.Invoice.where({
      id: invoiceId,
      businessId,
    }).first();

    if (!invoice) {
      throw new NotFoundException('Invoice not found for Paystack payment');
    }

    const expectedAmount = this.amountToSubunit(
      Number(invoice.totalAmount) - Number(invoice.amountPaid),
      String(invoice.currency),
    );

    if (transaction.amount !== expectedAmount) {
      throw new BadRequestException(
        `Paystack amount mismatch: expected ${expectedAmount}, received ${transaction.amount}`,
      );
    }

    if (
      String(transaction.currency).toUpperCase() !==
      String(invoice.currency).toUpperCase()
    ) {
      throw new BadRequestException(
        `Paystack currency mismatch: expected ${invoice.currency}, received ${transaction.currency}`,
      );
    }

    const existingPayment = await this.db.Payment.where({
      providerReference: reference,
    }).first();

    if (existingPayment) {
      await this.db.ProviderEvent
        .where({ id: providerEvent.id })
        .update({
          status: 'PROCESSED',
          processedAt: new Date().toISOString(),
        });

      return {
        received: true,
        processed: true,
        duplicatePayment: true,
        paymentId: existingPayment.id,
        eventId,
      };
    }

    const paidAmount = transaction.amount / 100;
    const currentPaid = Number(invoice.amountPaid);
    const total = Number(invoice.totalAmount);
    const newPaid = currentPaid + paidAmount;
    const invoiceStatus = newPaid >= total ? 'PAID' : 'PARTIALLY_PAID';

    const internalReference =
      String(metadata.internalReference ?? reference);

    const payment = await this.db.Payment.create({
      businessId,
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      paymentLinkId: paymentLinkId || undefined,
      providerPaymentId: String(transaction.id),
      providerReference: reference,
      internalReference,
      amount: String(paidAmount),
      currency: invoice.currency,
      status: 'SUCCEEDED',
      method: 'CARD',
      paidAt:
        transaction.paid_at ??
        new Date().toISOString(),
      metadata: {
        provider: 'paystack',
        channel: transaction.channel,
        customerEmail: transaction.customer?.email,
      },
    });

    await this.db.Invoice
      .where({ id: invoice.id })
      .update({
        amountPaid: String(newPaid),
        status: invoiceStatus,
      });

    const ledgerEntry = await this.db.LedgerEntry.create({
      businessId,
      paymentId: payment.id,
      type: 'PAYMENT',
      amount: String(paidAmount),
      currency: invoice.currency,
      description: `Paystack payment received for ${invoice.invoiceNumber}`,
    });

    const reconciliation = await this.db.Reconciliation.create({
      businessId,
      paymentId: payment.id,
      invoiceId: invoice.id,
      status: 'MATCHED',
      matchType: 'EXACT',
      confidence: '1',
      reason: 'Paystack payment verified and matched to invoice',
      matchedSignals: {
        provider: 'paystack',
        providerReference: reference,
        providerPaymentId: String(transaction.id),
        invoiceId: invoice.id,
        amount: String(paidAmount),
      },
      reviewedAt: new Date().toISOString(),
    });

    await this.db.ProviderEvent
      .where({ id: providerEvent.id })
      .update({
        status: 'PROCESSED',
        processedAt: new Date().toISOString(),
      });

    return {
      received: true,
      processed: true,
      eventId,
      payment,
      invoice: {
        ...invoice,
        amountPaid: String(newPaid),
        status: invoiceStatus,
      },
      ledgerEntry,
      reconciliation,
    };
  }
}
