import { Module } from '@nestjs/common';
import { TravelpayoutsModule } from '../travelpayouts/travelpayouts.module';
import { FareFinderService } from './fare-finder.service';

@Module({
  imports: [TravelpayoutsModule],
  providers: [FareFinderService],
  exports: [FareFinderService],
})
export class PricingModule {}
