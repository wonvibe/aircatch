import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { MeModule } from './me/me.module';
import { AirportsModule } from './airports/airports.module';
import { WatchesModule } from './watches/watches.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PriceMonitorModule } from './cron/price-monitor.module';
import { InternalModule } from './internal/internal.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Single source of truth at the repo root; see .env.example.
      envFilePath: ['.env', '../../.env'],
    }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    MeModule,
    AirportsModule,
    WatchesModule,
    NotificationsModule,
    PriceMonitorModule,
    InternalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
