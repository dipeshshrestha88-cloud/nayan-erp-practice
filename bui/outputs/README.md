# Nayan Construction ERP — local backend

## Start

1. Open PowerShell in this folder.
2. Run `node server.js`.
3. Open `http://localhost:3000`.

The UI will connect automatically. Initial administrator login is `admin@nirmaan.local` with password `ChangeMe123!`. Change this before any non-demo deployment.

This command is deliberately for local development only. `server.js` exits if `NODE_ENV=production`; it must never be pointed at a public domain or used as Nayan Construction's shared source of truth.

## Production architecture contract

The online deployment will use PostgreSQL as the central, multi-user system of record. The relational schema, tenant isolation policies, audit history, idempotency keys and migration runner are in `migrations/` and `src/`. Configuration is supplied through the deployment platform's secret manager—start with `.env.example`, but never commit a populated `.env` file.

- Run `npm install`, set `DATABASE_URL` and object-storage settings, then run `npm run migrate` against a managed PostgreSQL instance.
- Use `src/auth.js` for Argon2id passwords, opaque server-side session records and permission checks. UI roles are never trusted; every action must call server-side authorization.
- Use `src/storage.js` for documents. It keeps object keys in PostgreSQL and stores bytes in S3-compatible object storage (AWS S3, Cloudflare R2 or MinIO), not on the application disk.
- Scope every database transaction by tenant through `withTenantTransaction`; PostgreSQL row-level security provides a second isolation layer.
- Route handlers must be moved from the development adapter into the production composition root only through repository/transaction methods. Do not copy the file-backed `db` object into the deployed service.

No database, cloud storage, domain, account or deployment was created by this update.

## Included workflows

- In **My projects → BOQ site progress → Add BOQ item**, enter an item number, description, unit, quantity and contract rate. Estimated unit cost is optional. New items start with zero completed quantity; adding an item does not change the agreed project contract value.
- In **My projects → Daily expenses**, choose **Edit expense** on an existing payment, then **Save changes**. Edits retain before/after values in the audit history and reject stale revisions.
- Administrators can use **Delete project**. First review the linked-record counts, then continue and type the exact project name to confirm. The server requires both steps within five minutes and rejects deletion if project records change between confirmations. The project and linked operational/payment records leave active registers; a recovery snapshot is retained in `deletedProjects` in the local database. Bank guarantees, vendors, company documents and audit history remain. Recovery currently requires administrator assistance; there is no restore screen.
- Run `node --test work/project-actions.test.js work/site-log.test.js work/operations.test.js` from the parent workspace to check these actions with isolated test records.

- `POST /api/auth/login`, `GET /api/auth/me`
- Dashboard with empty-state reporting until the company creates records
- Project register, contract values, WBS/BOQ cost codes, budgets and separate cost/selling rates
- Procurement chain: vendor → requisition → purchase order → goods receipt → vendor bill → payment; approved commitments and actual costs reconcile to the BOQ
- Client running bills: measured BOQ work → submission → certification → receipt, with cumulative quantity controls, VAT, TDS, retention and advance recovery snapshots
- Integrated bank-guarantee register in Finance & compliance, including expiry, renewal/release status and facility exposure
- `GET, POST /api/projects`, `GET, POST /api/projects/:id/boq`, and `PATCH /api/projects/:id`
- `GET, POST /api/procurement/vendors`, requisitions, purchase orders, goods receipts, vendor bills and payments
- `GET, POST /api/billing/client-bills`, `PATCH /api/billing/client-bills/:id/action`, `POST /api/billing/client-receipts`, `GET /api/billing/summary`
- `GET, POST, PATCH /api/guarantees`; `GET, PATCH /api/settings/tax`; `GET /api/audit` (admin only)

Data lives in `data/nirmaan-db.json`, generated on first run. It is intentionally excluded from the source files because it contains the initial account hash and operational records; back it up before upgrading.

## Production deployment boundary

This is a local operational prototype. Its production data contract and migrations are now included, but the legacy route handlers have not yet been ported to PostgreSQL repositories. Before live deployment, complete that port; connect a real identity provider with MFA and password reset; enforce approval limits and segregation of duties; serve HTTPS behind a reverse proxy; encrypt and test backups; add document malware scanning; and have a Nepal chartered accountant validate VAT, TDS, retention, fiscal-calendar and IRD e-billing processes.
