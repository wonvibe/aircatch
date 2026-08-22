import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  @MinLength(10)
  expoPushToken!: string;

  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, unknown>;
}
