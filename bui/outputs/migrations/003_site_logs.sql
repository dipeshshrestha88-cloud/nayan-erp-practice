ALTER TABLE boq_items ADD COLUMN executed_quantity numeric(18,4) NOT NULL DEFAULT 0 CHECK(executed_quantity >= 0 AND executed_quantity <= quantity);
ALTER TABLE boq_items ADD COLUMN progress_revision integer NOT NULL DEFAULT 0;
CREATE TABLE site_expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 project_id uuid NOT NULL REFERENCES projects(id),
 expense_date date NOT NULL,
 category text NOT NULL CHECK(category IN ('Materials','Labor','Equipment/Fuel','Overheads')),
 description text NOT NULL,
 amount numeric(18,2) NOT NULL CHECK(amount>0),
 payment_mode text NOT NULL CHECK(payment_mode IN ('Cash','Bank transfer','Cheque','Other')),
 remarks text NOT NULL DEFAULT '',
 request_id text NOT NULL,
 revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,project_id,request_id)
);
CREATE INDEX site_expense_project_date ON site_expenses(tenant_id,project_id,expense_date DESC);
ALTER TABLE site_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_expenses FORCE ROW LEVEL SECURITY;
CREATE POLICY site_expense_tenant ON site_expenses
 USING(tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
