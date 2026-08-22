import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { MeModule } from './me/me.module';
import { AirportsModule } from './airports/airports.module';
import { WatchesModule } from './watches/watches.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Single source of truth at the repo root; see .env.example.
      envFilePath: ['.env', '../../.env'],
    }),
    SupabaseModule,
    MeModule,
    AirportsModule,
    WatchesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
