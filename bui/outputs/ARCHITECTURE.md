# Nayan Construction ERP production architecture

## Runtime boundary

The browser is a presentation client. It calls a stateless API over HTTPS. The API authenticates a request, resolves its tenant and role, authorizes the requested action, and performs the business operation inside a PostgreSQL transaction. Browser values—role, project identifier, totals and approval status—are never authority.

```
Employees → HTTPS / WAF → stateless ERP API → PostgreSQL (system of record)
                                      ├── S3-compatible object storage (documents)
                                      └── managed logs / metrics / backups
```

## Data and tenancy

One PostgreSQL database is the shared source of truth. Every operational table has `tenant_id`; row-level security requires the API to set `app.tenant_id` at the start of each transaction. All money uses `numeric(18,2)`, quantities use `numeric(18,4)`, and key records have foreign keys, uniqueness constraints, status history/audit events and idempotency support.

Apply numbered SQL migrations through `npm run migrate`; never change production schema manually. Backups should be point-in-time recoverable and routinely restored into an isolated verification environment.

## Identity and access

Passwords use Argon2id. Browser sessions are opaque random tokens; only token digests are stored in PostgreSQL and expiry/revocation is enforced server-side. The permission map in `src/auth.js` is a starting role matrix, not client-side decoration. Add MFA, password reset, invitation flows, rate limits and approval-value thresholds before go-live.

## Documents

Documents are uploaded to object storage using tenant-prefixed opaque keys. PostgreSQL records only metadata and ownership; short-lived signed download URLs are issued after authorization. Add virus scanning, retention policies and immutable evidence records before storing contract/measurement documents.

## Environments

- Development may use the existing JSON-backed adapter for quick UI work only.
- Test/staging and production use separate PostgreSQL databases, buckets, credentials and domains.
- Secrets belong in the platform secret manager and environment variables, never source, browser storage or migration files.
- Production CORS is restricted to the configured HTTPS application origin. TLS is terminated by the approved edge/reverse proxy.

## Current migration state

The central schema and production primitives are provided, but the current `server.js` remains a development adapter and is intentionally blocked in production. The next implementation increment is to migrate each domain route—projects/BOQ, procurement, billing, guarantees and documents—to PostgreSQL repositories under this contract, then add integration tests against a disposable PostgreSQL database.
