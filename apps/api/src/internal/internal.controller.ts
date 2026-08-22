import { Controller, Post, UseGuards } from '@nestjs/common';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { PriceMonitorService } from '../cron/price-monitor.service';

@UseGuards(InternalSecretGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly priceMonitor: PriceMonitorService) {}

  /** Manually runs both price-check sweeps once, bypassing the cron
   * schedule and slot filtering — for QA/debugging (see README). */
  @Post('cron/run-price-check')
  runPriceCheck() {
    return this.priceMonitor.runOnce();
  }
}
