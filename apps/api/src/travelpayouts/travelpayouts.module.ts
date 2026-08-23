import { Module } from '@nestjs/common';
import { TravelpayoutsService } from './travelpayouts.service';
import { PriceCacheService } from './price-cache.service';

@Module({
  providers: [TravelpayoutsService, PriceCacheService],
  exports: [TravelpayoutsService, PriceCacheService],
})
export class TravelpayoutsModule {}
