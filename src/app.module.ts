import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { CronModule } from './jobs/cron.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AuthModule } from './auth/auth.module.js';
import { DbModule } from './db/db.module.js';
import { MailerModule } from './mailers/mailer.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ObserveModule.forRoot({ appKey: 'YOUR_APP_KEY', appSecret: 'YOUR_APP_SECRET', serviceId: 'nestjs-start-kit' }),
        ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] }),
        ScheduleModule.forRoot(),
        CronModule,
        DbModule,
        MailerModule,
        AuthModule
    ]
})
export class AppModule {}
