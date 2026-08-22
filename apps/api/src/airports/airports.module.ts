import { Module } from '@nestjs/common';
import { AmadeusModule } from '../amadeus/amadeus.module';
import { AirportsController } from './airports.controller';
import { AirportsService } from './airports.service';

@Module({
  imports: [AmadeusModule],
  controllers: [AirportsController],
  providers: [AirportsService],
})
export class AirportsModule {}
