import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Verifies the `Authorization: Bearer <supabase_jwt>` header against Supabase
 * Auth and attaches the resolved user to `request.user`. The mobile app talks
 * to Supabase Auth directly (sign up / sign in / refresh); this guard only
 * ever validates the token it hands the API.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const { data, error } = await this.supabase.getClient().auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = { id: data.user.id, email: data.user.email ?? null };
    return true;
  }

  private extractBearerToken(header: string | undefined): string | null {
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' && token ? token : null;
  }
}
