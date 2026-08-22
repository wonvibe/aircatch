import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { TRIP_TYPES, type TripType } from '../watch-constants';
import { IATA_CODE_PATTERN, WatchSegmentDto } from './watch-segment.dto';

export class CreateWatchDto {
  @IsIn(TRIP_TYPES)
  tripType!: TripType;

  // Required for one_way/round_trip, must be absent for multi_city (segments carry the route instead).
  @ValidateIf((dto: CreateWatchDto) => dto.tripType !== 'multi_city')
  @Matches(IATA_CODE_PATTERN, {
    message: 'originIata must be a 3-letter IATA code',
  })
  originIata?: string;

  @ValidateIf((dto: CreateWatchDto) => dto.tripType !== 'multi_city')
  @Matches(IATA_CODE_PATTERN, {
    message: 'destinationIata must be a 3-letter IATA code',
  })
  destinationIata?: string;

  @IsDateString()
  departDateFrom!: string;

  @IsDateString()
  departDateTo!: string;

  @IsOptional()
  @IsDateString()
  returnDateFrom?: string;

  @IsOptional()
  @IsDateString()
  returnDateTo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  adults?: number;

  @IsPositive()
  targetPrice!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  // Required (2+ legs) for multi_city, ignored otherwise.
  @ValidateIf((dto: CreateWatchDto) => dto.tripType === 'multi_city')
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => WatchSegmentDto)
  segments?: WatchSegmentDto[];
}
