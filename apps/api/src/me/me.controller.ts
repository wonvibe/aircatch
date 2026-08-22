import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { MeService } from './me.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@UseGuards(SupabaseAuthGuard)
@Controller()
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('me')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.meService.getProfile(user.id);
  }

  @Post('me/device-tokens')
  registerDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.meService.registerDeviceToken(user.id, dto);
  }

  @Delete('me/device-tokens/:id')
  @HttpCode(204)
  async removeDeviceToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.meService.removeDeviceToken(user.id, id);
  }
}
