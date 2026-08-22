import { Module } from '@nestjs/common';
import { AmadeusService } from './amadeus.service';
import { PriceCacheService } from './price-cache.service';

@Module({
  providers: [AmadeusService, PriceCacheService],
  exports: [AmadeusService, PriceCacheService],
})
export class AmadeusModule {}
