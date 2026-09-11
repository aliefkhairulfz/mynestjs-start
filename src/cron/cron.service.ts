import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { type DbService, dbService } from '../db/db.module.js';

@Injectable()
export class CronService {
    private readonly logger = new Logger(CronService.name);

    constructor(@Inject(dbService) private readonly db: DbService) {}

    @Cron(CronExpression.EVERY_HOUR)
    async handleCron() {
        this.logger.log('running cron to clear expired sessions');
        const result = await this.db.session.deleteMany({
            where: {
                expiredAt: {
                    lt: new Date()
                }
            }
        });

        this.logger.log(`Cleared ${result.count} expired sessions`);
    }
}
