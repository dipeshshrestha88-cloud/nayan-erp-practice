const fs = require('node:fs/promises');
const path = require('node:path');
const { readConfig } = require('./config');
const { createDatabase } = require('./db');

async function migrate() {
  const config = readConfig();
  if (!config.databaseUrl) throw new Error('Set DATABASE_URL before running migrations');
  const db = createDatabase(config);
  try {
    await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const directory = path.join(__dirname, '..', 'migrations');
    const files = (await fs.readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
    for (const file of files) {
      const prior = await db.query('SELECT 1 FROM schema_migrations WHERE version=$1', [file]);
      if (prior.rowCount) continue;
      const sql = await fs.readFile(path.join(directory, file), 'utf8');
      await db.withTenantTransaction('00000000-0000-0000-0000-000000000000', async client => {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [file]);
      });
      console.log(`Applied ${file}`);
    }
  } finally {
    await db.close();
  }
}

migrate().catch(error => { console.error(error.message); process.exitCode = 1; });
