import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingModule } from '../pricing/pricing.module';
import { PriceMonitorService } from './price-monitor.service';

@Module({
  imports: [PricingModule, NotificationsModule],
  providers: [PriceMonitorService],
  exports: [PriceMonitorService],
})
export class PriceMonitorModule {}
