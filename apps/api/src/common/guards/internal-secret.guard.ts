import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guards /internal/* routes with a shared secret header instead of a
 * Supabase user JWT — these are ops/QA endpoints (manual cron trigger,
 * quota checks), never something an end-user account calls.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>('INTERNAL_CRON_SECRET');
    const provided = request.headers['x-internal-secret'];

    if (!expected) {
      throw new UnauthorizedException('INTERNAL_CRON_SECRET is not configured');
    }
    if (provided !== expected) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    return true;
  }
}
