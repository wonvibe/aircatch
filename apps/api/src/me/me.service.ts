import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { DeviceTokenRow, ProfileRow } from './me.entities';

@Injectable()
export class MeService {
  constructor(private readonly supabase: SupabaseService) {}

  async getProfile(userId: string): Promise<ProfileRow> {
    const result = await this.supabase
      .getClient()
      .from('profiles')
      .select('id, email, display_name, created_at')
      .eq('id', userId)
      .single();

    if (result.error || !result.data) {
      throw new NotFoundException('Profile not found');
    }
    return result.data;
  }

  /** Upserts by expo_push_token so re-registering the same device is idempotent. */
  async registerDeviceToken(
    userId: string,
    dto: RegisterDeviceTokenDto,
  ): Promise<DeviceTokenRow> {
    const result = await this.supabase
      .getClient()
      .from('device_tokens')
      .upsert(
        {
          user_id: userId,
          expo_push_token: dto.expoPushToken,
          device_info: dto.deviceInfo ?? null,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'expo_push_token' },
      )
      .select()
      .single();

    if (result.error) {
      throw result.error;
    }
    return result.data;
  }

  async removeDeviceToken(userId: string, id: string): Promise<void> {
    const result = await this.supabase
      .getClient()
      .from('device_tokens')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }
    if (!result.data) {
      throw new NotFoundException('Device token not found');
    }
  }
}
