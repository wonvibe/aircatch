import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { WATCH_STATUSES, type WatchStatus } from '../watch-constants';
import { IATA_CODE_PATTERN, WatchSegmentDto } from './watch-segment.dto';

// Whether a given field is even legal to set depends on the target watch's
// trip_type (originIata/destinationIata for one_way/round_trip vs. segments
// for multi_city) — that's only known once WatchesService loads the
// existing row, so this DTO validates shape only; WatchesService.update
// rejects the wrong combination for a given watch.
export class UpdateWatchDto {
  @IsOptional()
  @IsPositive()
  targetPrice?: number;

  @IsOptional()
  @IsIn(WATCH_STATUSES)
  status?: WatchStatus;

  @IsOptional()
  @Matches(IATA_CODE_PATTERN, {
    message: 'originIata must be a 3-letter IATA code',
  })
  originIata?: string;

  @IsOptional()
  @Matches(IATA_CODE_PATTERN, {
    message: 'destinationIata must be a 3-letter IATA code',
  })
  destinationIata?: string;

  @IsOptional()
  @IsDateString()
  departDateFrom?: string;

  @IsOptional()
  @IsDateString()
  departDateTo?: string;

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

  // multi_city only — replaces the watch's entire segment list.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => WatchSegmentDto)
  segments?: WatchSegmentDto[];
}
