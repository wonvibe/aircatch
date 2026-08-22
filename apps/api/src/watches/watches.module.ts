import { Module } from '@nestjs/common';
import { AmadeusModule } from '../amadeus/amadeus.module';
import { WatchesController } from './watches.controller';
import { WatchesService } from './watches.service';

@Module({
  imports: [AmadeusModule],
  controllers: [WatchesController],
  providers: [WatchesService],
})
export class WatchesModule {}
