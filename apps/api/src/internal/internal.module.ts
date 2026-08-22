import { Module } from '@nestjs/common';
import { PriceMonitorModule } from '../cron/price-monitor.module';
import { InternalController } from './internal.controller';

@Module({
  imports: [PriceMonitorModule],
  controllers: [InternalController],
})
export class InternalModule {}
