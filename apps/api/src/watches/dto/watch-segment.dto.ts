import { IsDateString, IsInt, Matches, Min } from 'class-validator';

export const IATA_CODE_PATTERN = /^[A-Z]{3}$/;

export class WatchSegmentDto {
  @IsInt()
  @Min(0)
  sequenceNo!: number;

  @Matches(IATA_CODE_PATTERN, {
    message: 'originIata must be a 3-letter IATA code',
  })
  originIata!: string;

  @Matches(IATA_CODE_PATTERN, {
    message: 'destinationIata must be a 3-letter IATA code',
  })
  destinationIata!: string;

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;
}
