import { IsIn, IsOptional, IsPositive } from 'class-validator';
import { WATCH_STATUSES, type WatchStatus } from '../watch-constants';

export class UpdateWatchDto {
  @IsOptional()
  @IsPositive()
  targetPrice?: number;

  @IsOptional()
  @IsIn(WATCH_STATUSES)
  status?: WatchStatus;
}
