import { Module } from '@nestjs/common';
import { AmadeusModule } from '../amadeus/amadeus.module';
import { FareFinderService } from './fare-finder.service';

@Module({
  imports: [AmadeusModule],
  providers: [FareFinderService],
  exports: [FareFinderService],
})
export class PricingModule {}
