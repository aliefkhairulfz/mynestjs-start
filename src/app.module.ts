import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './cron/cron.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AuthModule } from './auth/auth.module.js';
import { DbModule } from './db/db.module.js';
import { MailerModule } from './mailer/mailer.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
    imports: [
        // Distributed tracing, auto-correlated logs, request/job metrics, error
        // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
        ConfigModule.forRoot({ isGlobal: true }),
        ObserveModule.forRoot({
            appKey: 'YOUR_APP_KEY',
            appSecret: 'YOUR_APP_SECRET',
            serviceId: 'nestjs-start-kit'
        }),
        ScheduleModule.forRoot(),
        CronModule,
        DbModule,
        MailerModule,
        AuthModule
    ]
})
export class AppModule {}
