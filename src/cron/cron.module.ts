import { Module } from '@nestjs/common';
import { CronService } from './cron.service.js';

@Module({
    providers: [CronService]
})
export class CronModule {}
