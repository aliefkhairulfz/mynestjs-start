import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { type DbService, dbService } from '../db/db.module.js';

@Injectable()
export class CronService {
    constructor(@Inject(dbService) private readonly db: DbService) {}

    @Cron(CronExpression.EVERY_HOUR)
    async handleCron() {
        await this.db.session.deleteMany({
            where: {
                expiredAt: {
                    lt: new Date()
                }
            }
        });
    }
}
