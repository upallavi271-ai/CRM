// Local PostgreSQL without Docker. Data lives in backend/.pgdata.
// Usage: npm run db:dev   (keep this terminal open, Ctrl+C to stop)
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.pgdata');

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'crm',
  password: 'crm',
  port: 5432,
  persistent: true,
});

if (!existsSync(dataDir)) {
  console.log('First run: initialising database in', dataDir);
  await pg.initialise();
}

await pg.start();

try {
  await pg.createDatabase('crm');
  console.log('Created database "crm"');
} catch {
  // already exists
}

console.log('PostgreSQL running on localhost:5432 (db: crm). Press Ctrl+C to stop.');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
