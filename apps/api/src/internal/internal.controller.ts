import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { PriceMonitorService } from '../cron/price-monitor.service';
import { TravelpayoutsService } from '../travelpayouts/travelpayouts.service';

@UseGuards(InternalSecretGuard)
@Controller('internal')
export class InternalController {
  constructor(
    private readonly priceMonitor: PriceMonitorService,
    private readonly travelpayouts: TravelpayoutsService,
  ) {}

  /** Manually runs both price-check sweeps once, bypassing the cron
   * schedule and slot filtering — for QA/debugging (see README). */
  @Post('cron/run-price-check')
  runPriceCheck() {
    return this.priceMonitor.runOnce();
  }

  /** In-process call count since this API instance started (not persisted —
   * resets on restart). Travelpayouts has no monthly quota, only a 10 req/s
   * rate limit, so this is call-volume visibility, not a quota warning. */
  @Get('travelpayouts/usage-status')
  getTravelpayoutsUsageStatus() {
    return this.travelpayouts.getUsageStats();
  }
}
