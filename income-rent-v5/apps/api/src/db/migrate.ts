// Database migration runner
import { migrate } from 'drizzle-orm/libsql/migrator';
import { db } from './index.js';

console.log('[DB] Running migrations...');

await migrate(db, { migrationsFolder: './drizzle' });

console.log('[DB] Migrations complete');
process.exit(0);
