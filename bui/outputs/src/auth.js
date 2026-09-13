const crypto = require('node:crypto');
const argon2 = require('argon2');

const ROLE_PERMISSIONS = Object.freeze({
  admin: ['*'],
  managing_director: ['dashboard.read', 'project.read', 'project.approve', 'procurement.read', 'finance.read', 'finance.approve', 'guarantee.read', 'guarantee.approve'],
  project_manager: ['dashboard.read', 'project.read', 'project.write', 'procurement.read', 'procurement.write'],
  procurement_manager: ['dashboard.read', 'project.read', 'procurement.read', 'procurement.write', 'procurement.approve'],
  finance_manager: ['dashboard.read', 'project.read', 'finance.read', 'finance.write', 'finance.approve', 'guarantee.read', 'guarantee.write', 'guarantee.approve'],
  site_engineer: ['project.read', 'project.write', 'procurement.read', 'procurement.write'],
  accountant: ['finance.read', 'finance.write', 'guarantee.read'],
  viewer: ['dashboard.read', 'project.read', 'procurement.read', 'finance.read', 'guarantee.read']
});

function digest(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function can(user, permission) { const grants = ROLE_PERMISSIONS[user.role] || []; return grants.includes('*') || grants.includes(permission); }
function requirePermission(user, permission) {
  if (!can(user, permission)) { const error = new Error('Insufficient permission'); error.statusCode = 403; throw error; }
}

async function verifyPassword(password, passwordHash) { return argon2.verify(passwordHash, password, { type: argon2.argon2id }); }
async function hashPassword(password) { return argon2.hash(password, { type: argon2.argon2id }); }

async function createSession(client, user, metadata = {}) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await client.query(
    `INSERT INTO sessions (tenant_id, user_id, token_digest, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user.tenant_id, user.id, digest(token), expiresAt, metadata.ip || null, metadata.userAgent || null]
  );
  return { token, expiresAt };
}

async function authenticate(client, rawToken) {
  if (!rawToken) return null;
  const { rows } = await client.query(
    `SELECT u.id, u.tenant_id, u.name, u.email, u.role
       FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_digest=$1 AND s.expires_at > now() AND s.revoked_at IS NULL AND u.active=true`,
    [digest(rawToken)]
  );
  return rows[0] || null;
}

module.exports = { ROLE_PERMISSIONS, hashPassword, verifyPassword, createSession, authenticate, requirePermission };
