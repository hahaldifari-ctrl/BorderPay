import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  getHello() {
    return 'Hello World!';
  }

  @Get('health')
  async getHealth() {
    try {
      const business = await this.database.client.orm.public.Business.first();

      return {
        status: 'ok',
        database: 'connected',
        businesses: business ? 1 : 0,
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        message:
          error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  @Get('businesses')
  async getBusinesses() {
    return this.database.client.orm.public.Business.all();
  }
}