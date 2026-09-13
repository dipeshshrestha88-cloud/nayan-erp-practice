const { Pool } = require('pg');

function createDatabase(config) {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required for the central database adapter');
  const pool = new Pool({ connectionString: config.databaseUrl, ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined, max: 15 });
  return {
    query: (text, params) => pool.query(text, params),
    async withTenantTransaction(tenantId, work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end()
  };
}

module.exports = { createDatabase };
