import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { DefaultArgs } from '@prisma/client/runtime/client';
import { PrismaClient } from '../generated/prisma/client.js';
import { GlobalOmitConfig } from '../generated/prisma/internal/prismaNamespace.js';

/** Token used for injecting the database service. */
export const dbService = 'PrismaClient';

/** Type alias for the PrismaClient instance used as the database service. */
export type DbService = PrismaClient<never, GlobalOmitConfig | undefined, DefaultArgs>;

/**
 * Global module for database connectivity.
 * Provides the PrismaClient configured with MariaDB adapter.
 */
@Global()
@Module({
    providers: [
        {
            provide: dbService,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const adapter = new PrismaMariaDb({
                    host: config.getOrThrow<string>('DATABASE_HOST'),
                    user: config.getOrThrow<string>('DATABASE_USER'),
                    password: config.getOrThrow<string>('DATABASE_PASSWORD'),
                    database: config.getOrThrow<string>('DATABASE_NAME'),
                    connectionLimit: 5
                });

                const newPrisma = new PrismaClient({ adapter });
                console.log('db module mounted');

                return newPrisma;
            }
        }
    ],
    exports: [dbService]
})
export class DbModule {}
