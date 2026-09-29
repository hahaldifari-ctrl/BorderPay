import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { MvpController } from './mvp/mvp.controller';
import { MvpService } from './mvp/mvp.service';
import { PaystackController } from './payments/paystack.controller';
import { PaystackService } from './payments/paystack.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    AppController,
    MvpController,
    PaystackController,
  ],
  providers: [
    AppService,
    MvpService,
    PaystackService,
  ],
})
export class AppModule {}
