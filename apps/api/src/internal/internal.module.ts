import { Module } from '@nestjs/common';
import { PriceMonitorModule } from '../cron/price-monitor.module';
import { TravelpayoutsModule } from '../travelpayouts/travelpayouts.module';
import { InternalController } from './internal.controller';

@Module({
  imports: [PriceMonitorModule, TravelpayoutsModule],
  controllers: [InternalController],
})
export class InternalModule {}
