import 'dotenv/config';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER ?? 'root',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME!,
    connectionLimit: 5
});

const prisma = new PrismaClient({
    adapter
});

async function main() {
    console.log('🌱 Seeding database...');

    await prisma.role.createMany({
        data: [{ name: 'USER' }, { name: 'CREATOR' }, { name: 'ADMIN' }, { name: 'SUPERADMIN' }],
        skipDuplicates: true
    });

    console.log('✅ Roles seeded successfully');
}

main()
    .catch(error => {
        console.error('❌ Seeding failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
