import {
  Controller,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaystackService } from './paystack.service';

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

@Controller()
export class PaystackController {
  constructor(private readonly paystack: PaystackService) {}

  @Post('payments/paystack/:token')
  initializePayment(@Param('token') token: string) {
    return this.paystack.initializePayment(token);
  }

  @Post('webhooks/paystack')
  async webhook(
    @Req() req: RawBodyRequest,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new Error('Raw webhook body is unavailable');
    }

    return this.paystack.processWebhook(rawBody, signature);
  }
}
