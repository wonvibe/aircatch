import { IsString, MinLength } from 'class-validator';

export class SearchAirportsDto {
  @IsString()
  @MinLength(1)
  q!: string;
}
