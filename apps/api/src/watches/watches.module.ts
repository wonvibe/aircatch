import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { WatchesController } from './watches.controller';
import { WatchesService } from './watches.service';

@Module({
  imports: [PricingModule],
  controllers: [WatchesController],
  providers: [WatchesService],
})
export class WatchesModule {}
