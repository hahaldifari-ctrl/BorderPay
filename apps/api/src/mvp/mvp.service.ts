import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MvpService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.client.orm.public;
  }

  async createBusiness(data: {
    name: string;
    email?: string;
    country?: string;
    defaultCurrency?: string;
  }) {
    return this.db.Business.create({
      name: data.name,
      email: data.email,
      country: data.country ?? 'NG',
      defaultCurrency: data.defaultCurrency ?? 'NGN',
    });
  }

  async createCustomer(data: {
    businessId: string;
    name: string;
    email?: string;
    phone?: string;
    companyName?: string;
    country?: string;
  }) {
    const business = await this.db.Business.where({
      id: data.businessId,
    }).first();

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return this.db.Customer.create({
      businessId: data.businessId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      companyName: data.companyName,
      country: data.country,
    });
  }

  async createInvoice(data: {
    businessId: string;
    customerId: string;
    invoiceNumber: string;
    description?: string;
    currency?: string;
    totalAmount: string | number;
    dueDate?: string;
  }) {
    const business = await this.db.Business.where({
      id: data.businessId,
    }).first();

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const customer = await this.db.Customer.where({
      id: data.customerId,
      businessId: data.businessId,
    }).first();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.db.Invoice.create({
      businessId: data.businessId,
      customerId: data.customerId,
      invoiceNumber: data.invoiceNumber,
      description: data.description,
      currency: data.currency ?? business.defaultCurrency,
      totalAmount: String(data.totalAmount),
      amountPaid: '0',
      status: 'DRAFT',
      dueDate: data.dueDate,
    });
  }

  async createPaymentLink(data: {
    businessId: string;
    invoiceId: string;
    expiresAt?: string;
  }) {
    const invoice = await this.db.Invoice.where({
      id: data.invoiceId,
      businessId: data.businessId,
    }).first();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const token = randomBytes(12).toString('hex');

    return this.db.PaymentLink.create({
      businessId: data.businessId,
      invoiceId: data.invoiceId,
      token,
      status: 'ACTIVE',
      expiresAt: data.expiresAt,
    });
  }

  async getPaymentLink(token: string) {
    const paymentLink = await this.db.PaymentLink.where({
      token,
    }).first();

    if (!paymentLink) {
      throw new NotFoundException('Payment link not found');
    }

    const invoice = await this.db.Invoice.where({
      id: paymentLink.invoiceId,
    }).first();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const customer = await this.db.Customer.where({
      id: invoice.customerId,
    }).first();

    const business = await this.db.Business.where({
      id: paymentLink.businessId,
    }).first();

    return {
      paymentLink,
      invoice,
      customer,
      business,
    };
  }

  async simulatePayment(data: {
    businessId: string;
    invoiceId: string;
    amount: string | number;
    method?: string;
    paymentLinkId?: string;
  }) {
    const invoice = await this.db.Invoice.where({
      id: data.invoiceId,
      businessId: data.businessId,
    }).first();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const amount = Number(data.amount);
    const total = Number(invoice.totalAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const currentPaid = Number(invoice.amountPaid);
    const remaining = Math.max(total - currentPaid, 0);

    if (remaining <= 0) {
      throw new Error('Invoice is already fully paid');
    }

    if (amount > remaining) {
      throw new Error(
        `Payment cannot exceed the outstanding amount of ${remaining}`,
      );
    }

    const newPaid = currentPaid + amount;
    const invoiceStatus = newPaid >= total ? 'PAID' : 'PARTIALLY_PAID';

    const internalReference =
      `BP-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;

    const payment = await this.db.Payment.create({
      businessId: data.businessId,
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      paymentLinkId: data.paymentLinkId,
      internalReference,
      amount: String(amount),
      currency: invoice.currency,
      status: 'SUCCEEDED',
      method: data.method ?? 'CARD',
      paidAt: new Date().toISOString(),
    });

    await this.db.Invoice
      .where({ id: invoice.id })
      .update({
        amountPaid: String(newPaid),
        status: invoiceStatus,
      });

    const ledgerEntry = await this.db.LedgerEntry.create({
      businessId: data.businessId,
      paymentId: payment.id,
      type: 'PAYMENT',
      amount: String(amount),
      currency: invoice.currency,
      description: `Payment received for ${invoice.invoiceNumber}`,
    });

    const reconciliation = await this.db.Reconciliation.create({
      businessId: data.businessId,
      paymentId: payment.id,
      invoiceId: invoice.id,
      status: 'MATCHED',
      matchType: 'EXACT',
      confidence: '1',
      reason: 'Payment matched to invoice during simulated payment processing',
      matchedSignals: {
        invoiceId: invoice.id,
        amount: String(amount),
        internalReference,
      },
      reviewedAt: new Date().toISOString(),
    });

    return {
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

  async simulatePaymentByLink(data: {
    token: string;
    amount?: string | number;
    method?: string;
  }) {
    const paymentLink = await this.db.PaymentLink.where({
      token: data.token,
    }).first();

    if (!paymentLink) {
      throw new NotFoundException('Payment link not found');
    }

    if (paymentLink.status !== 'ACTIVE') {
      throw new Error('Payment link is not active');
    }

    const invoice = await this.db.Invoice.where({
      id: paymentLink.invoiceId,
      businessId: paymentLink.businessId,
    }).first();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const remaining =
      Number(invoice.totalAmount) - Number(invoice.amountPaid);

    if (remaining <= 0) {
      throw new Error('Invoice is already fully paid');
    }

    return this.simulatePayment({
      businessId: paymentLink.businessId,
      invoiceId: paymentLink.invoiceId,
      amount: data.amount ?? remaining,
      method: data.method ?? 'CARD',
      paymentLinkId: paymentLink.id,
    });
  }

  async getDashboard(businessId: string) {
    const business = await this.db.Business.where({
      id: businessId,
    }).first();

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const customers = await this.db.Customer.where({
      businessId,
    }).all();

    const invoices = await this.db.Invoice.where({
      businessId,
    }).all();

    const payments = await this.db.Payment.where({
      businessId,
    }).all();

    const reconciliations = await this.db.Reconciliation.where({
      businessId,
    }).all();

    const paymentLinks = await this.db.PaymentLink.where({
      businessId,
    }).all();

    const totalInvoiced = invoices.reduce(
      (sum: number, invoice: any) => sum + Number(invoice.totalAmount),
      0,
    );

    const totalPaid = payments
      .filter((payment: any) => payment.status === 'SUCCEEDED')
      .reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);

    const outstanding = Math.max(totalInvoiced - totalPaid, 0);

    return {
      business,
      stats: {
        customers: customers.length,
        invoices: invoices.length,
        payments: payments.length,
        reconciledPayments: reconciliations.filter(
          (item: any) => item.status === 'MATCHED',
        ).length,
        totalInvoiced,
        totalPaid,
        outstanding,
        currency: business.defaultCurrency,
      },
      customers,
      invoices,
      payments,
      reconciliations,
      paymentLinks,
    };
  }
}
