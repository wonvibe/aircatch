export interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
}

export interface DeviceTokenRow {
  id: string;
  user_id: string;
  expo_push_token: string;
  device_info: Record<string, unknown> | null;
  created_at: string;
  last_active_at: string;
}
