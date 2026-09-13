CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text NOT NULL UNIQUE,
  currency char(3) NOT NULL DEFAULT 'NPR', fiscal_year text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL, email citext NOT NULL, password_hash text NOT NULL, role text NOT NULL,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id),
  token_digest char(64) NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz,
  ip_address inet, user_agent text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL, name text NOT NULL, client_name text NOT NULL, contract_value numeric(18,2) NOT NULL CHECK(contract_value >= 0),
  status text NOT NULL DEFAULT 'Setup', start_date date, completion_date date,
  created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
CREATE TABLE boq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), project_id uuid NOT NULL REFERENCES projects(id),
  cost_code text NOT NULL, description text NOT NULL, unit text NOT NULL, quantity numeric(18,4) NOT NULL CHECK(quantity > 0),
  cost_rate numeric(18,2) NOT NULL CHECK(cost_rate >= 0), selling_rate numeric(18,2) NOT NULL CHECK(selling_rate >= 0),
  baseline_version integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id, cost_code, baseline_version)
);
CREATE TABLE vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL,
  pan text, contact text, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), project_id uuid NOT NULL REFERENCES projects(id),
  boq_item_id uuid NOT NULL REFERENCES boq_items(id), quantity numeric(18,4) NOT NULL CHECK(quantity > 0), requested_rate numeric(18,2) NOT NULL CHECK(requested_rate >= 0),
  status text NOT NULL DEFAULT 'Draft', created_by uuid REFERENCES users(id), approved_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), number text NOT NULL,
  requisition_id uuid NOT NULL REFERENCES requisitions(id), vendor_id uuid NOT NULL REFERENCES vendors(id), project_id uuid NOT NULL REFERENCES projects(id), boq_item_id uuid NOT NULL REFERENCES boq_items(id),
  quantity numeric(18,4) NOT NULL CHECK(quantity > 0), unit_rate numeric(18,2) NOT NULL CHECK(unit_rate >= 0), status text NOT NULL DEFAULT 'Pending approval',
  created_by uuid REFERENCES users(id), approved_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id, number)
);
CREATE TABLE goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), number text NOT NULL, purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  quantity numeric(18,4) NOT NULL CHECK(quantity > 0), received_at timestamptz NOT NULL, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id, number)
);
CREATE TABLE vendor_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), number text NOT NULL, goods_receipt_id uuid NOT NULL REFERENCES goods_receipts(id),
  net_amount numeric(18,2) NOT NULL CHECK(net_amount >= 0), vat_rate numeric(5,2) NOT NULL CHECK(vat_rate BETWEEN 0 AND 100), status text NOT NULL DEFAULT 'Pending approval',
  approved_by uuid REFERENCES users(id), created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id, number)
);
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), vendor_bill_id uuid NOT NULL REFERENCES vendor_bills(id),
  amount numeric(18,2) NOT NULL CHECK(amount > 0), reference text NOT NULL, paid_at timestamptz NOT NULL, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id, reference)
);
CREATE TABLE client_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), number text NOT NULL, project_id uuid NOT NULL REFERENCES projects(id),
  ad_date date NOT NULL, bs_date text, gross_amount numeric(18,2) NOT NULL, vat_rate numeric(5,2) NOT NULL, tds_rate numeric(5,2) NOT NULL, retention_rate numeric(5,2) NOT NULL,
  advance_recovery numeric(18,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'Draft', submitted_at timestamptz, certified_at timestamptz, certified_by uuid REFERENCES users(id),
  created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id, number)
);
CREATE TABLE client_bill_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), client_bill_id uuid NOT NULL REFERENCES client_bills(id) ON DELETE CASCADE,
  boq_item_id uuid NOT NULL REFERENCES boq_items(id), quantity numeric(18,4) NOT NULL CHECK(quantity > 0), selling_rate numeric(18,2) NOT NULL CHECK(selling_rate >= 0), gross_amount numeric(18,2) NOT NULL CHECK(gross_amount >= 0)
);
CREATE TABLE client_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), client_bill_id uuid NOT NULL REFERENCES client_bills(id),
  amount numeric(18,2) NOT NULL CHECK(amount > 0), ad_date date NOT NULL, bs_date text, reference text NOT NULL, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id, reference)
);
CREATE TABLE bank_guarantees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), reference text NOT NULL, project_id uuid REFERENCES projects(id),
  category text NOT NULL, bank text NOT NULL, beneficiary text NOT NULL, amount numeric(18,2) NOT NULL CHECK(amount > 0), issue_date date NOT NULL, expiry_date date NOT NULL,
  status text NOT NULL DEFAULT 'Running', released_at timestamptz, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id, reference)
);
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), entity_type text NOT NULL, entity_id uuid NOT NULL,
  object_key text NOT NULL, original_name text NOT NULL, content_type text NOT NULL, size_bytes bigint NOT NULL CHECK(size_bytes >= 0),
  uploaded_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id, object_key)
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), actor_id uuid REFERENCES users(id),
  action text NOT NULL, entity_type text NOT NULL, entity_id uuid, before_state jsonb, after_state jsonb, request_id uuid, ip_address inet, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE idempotency_keys (
  tenant_id uuid NOT NULL REFERENCES tenants(id), key text NOT NULL, request_hash char(64) NOT NULL, response_status integer NOT NULL, response_body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id, key)
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id, status);
CREATE INDEX idx_boq_project ON boq_items(tenant_id, project_id);
CREATE INDEX idx_audit_events_tenant ON audit_events(tenant_id, created_at DESC);
CREATE INDEX idx_documents_entity ON documents(tenant_id, entity_type, entity_id);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['users','sessions','projects','boq_items','vendors','requisitions','purchase_orders','goods_receipts','vendor_bills','payments','client_bills','client_bill_lines','client_receipts','bank_guarantees','documents','audit_events','idempotency_keys'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)', table_name);
  END LOOP;
END $$;
