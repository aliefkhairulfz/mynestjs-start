import 'dotenv/config';
import mariadb from 'mariadb';

async function main() {
    console.log('🗑️  Dropping all tables...');

    const pool = mariadb.createPool({
        host: process.env.DATABASE_HOST ?? 'localhost',
        port: Number(process.env.DATABASE_PORT ?? 3306),
        user: process.env.DATABASE_USER ?? 'root',
        password: process.env.DATABASE_PASSWORD ?? '',
        database: process.env.DATABASE_NAME!,
        connectionLimit: 1
    });

    let conn;
    try {
        conn = await pool.getConnection();

        // Disable foreign key constraints first
        console.log('🔓 Disabling foreign key checks...');
        await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

        // Fetch all tables from the database
        const tables = await conn.query(
            `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?;`,
            [process.env.DATABASE_NAME]
        );

        if (tables.length === 0) {
            console.log('ℹ️  No tables found to drop.');
        } else {
            // Drop all tables
            for (const row of tables) {
                console.log(`🧨 Dropping table: ${row.TABLE_NAME}`);
                await conn.query(`DROP TABLE IF EXISTS \`${row.TABLE_NAME}\`;`);
            }
        }

        // Re-enable foreign key constraints
        console.log('🔒 Re-enabling foreign key checks...');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1;');

        console.log('✅ All tables dropped successfully.');
    } catch (error) {
        console.error('❌ Error dropping tables:', error);
        process.exitCode = 1;
    } finally {
        if (conn) await conn.release();
        await pool.end();
    }
}

main();
