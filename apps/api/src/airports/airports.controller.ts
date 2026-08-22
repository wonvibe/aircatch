import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { AirportsService } from './airports.service';
import { SearchAirportsDto } from './dto/search-airports.dto';

@UseGuards(SupabaseAuthGuard)
@Controller('airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get('search')
  search(@Query() query: SearchAirportsDto) {
    return this.airportsService.search(query.q);
  }
}
