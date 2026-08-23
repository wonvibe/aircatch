import { Module } from '@nestjs/common';
import { PriceMonitorModule } from '../cron/price-monitor.module';
import { AmadeusModule } from '../amadeus/amadeus.module';
import { InternalController } from './internal.controller';

@Module({
  imports: [PriceMonitorModule, AmadeusModule],
  controllers: [InternalController],
})
export class InternalModule {}
