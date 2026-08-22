import { Module } from '@nestjs/common';
import { WatchesController } from './watches.controller';
import { WatchesService } from './watches.service';

@Module({
  controllers: [WatchesController],
  providers: [WatchesService],
})
export class WatchesModule {}
