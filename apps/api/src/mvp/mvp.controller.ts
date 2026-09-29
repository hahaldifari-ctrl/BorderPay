import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MvpService } from './mvp.service';

@Controller()
export class MvpController {
  constructor(private readonly mvp: MvpService) {}

  @Post('businesses')
  createBusiness(@Body() body: any) {
    return this.mvp.createBusiness(body);
  }

  @Post('customers')
  createCustomer(@Body() body: any) {
    return this.mvp.createCustomer(body);
  }

  @Post('invoices')
  createInvoice(@Body() body: any) {
    return this.mvp.createInvoice(body);
  }

  @Post('payment-links')
  createPaymentLink(@Body() body: any) {
    return this.mvp.createPaymentLink(body);
  }

  @Get('payment-links/:token')
  getPaymentLink(@Param('token') token: string) {
    return this.mvp.getPaymentLink(token);
  }

  @Post('payments/simulate')
  simulatePayment(@Body() body: any) {
    return this.mvp.simulatePayment(body);
  }

  @Post('payments/simulate-link')
  simulatePaymentByLink(@Body() body: any) {
    return this.mvp.simulatePaymentByLink(body);
  }

  @Get('dashboard/:businessId')
  getDashboard(@Param('businessId') businessId: string) {
    return this.mvp.getDashboard(businessId);
  }
}
