/*
 * Production composition root. Route handlers move here only after they use
 * the PostgreSQL repositories, server-side sessions and object storage in src/.
 * The legacy server.js is intentionally blocked in NODE_ENV=production.
 */
const { readConfig } = require('./config');
const { createDatabase } = require('./db');
const { createObjectStorage } = require('./storage');

async function verifyProductionDependencies() {
  const config = readConfig();
  if (!config.production) throw new Error('start:production requires NODE_ENV=production');
  const db = createDatabase(config);
  try {
    await db.query('SELECT 1');
    createObjectStorage(config);
    console.log('Production dependencies verified. Run migrations before enabling production routes.');
  } finally {
    await db.close();
  }
}

verifyProductionDependencies().catch(error => { console.error(`Production configuration invalid: ${error.message}`); process.exitCode = 1; });
