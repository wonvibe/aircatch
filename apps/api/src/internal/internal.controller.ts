import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';
import { PriceMonitorService } from '../cron/price-monitor.service';
import { AmadeusService } from '../amadeus/amadeus.service';

@UseGuards(InternalSecretGuard)
@Controller('internal')
export class InternalController {
  constructor(
    private readonly priceMonitor: PriceMonitorService,
    private readonly amadeus: AmadeusService,
  ) {}

  /** Manually runs both price-check sweeps once, bypassing the cron
   * schedule and slot filtering — for QA/debugging (see README). */
  @Post('cron/run-price-check')
  runPriceCheck() {
    return this.priceMonitor.runOnce();
  }

  /** In-process call counts since this API instance started (not persisted
   * — resets on restart). Meant for a quick "are we anywhere near the free
   * tier's monthly quota" check, not exact accounting. */
  @Get('amadeus/quota-status')
  getAmadeusQuotaStatus() {
    return this.amadeus.getUsageStats();
  }
}
