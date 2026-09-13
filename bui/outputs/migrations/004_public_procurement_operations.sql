CREATE TABLE public_tenders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 title text NOT NULL, public_entity text NOT NULL, ifb text NOT NULL,
 deadline date, prepared boolean NOT NULL DEFAULT false,
 guarantee_applied boolean NOT NULL DEFAULT false, security_released boolean NOT NULL DEFAULT false,
 status text NOT NULL CHECK(status IN ('Not awarded','Preparing','Submitted','Awarded','Not successful','Withdrawn')),
 security_amount numeric(18,2) NOT NULL CHECK(security_amount >= 0),
 security_fee numeric(18,2) NOT NULL CHECK(security_fee >= 0),
 guarantee_id uuid REFERENCES bank_guarantees(id), project_id uuid REFERENCES projects(id),
 notes text NOT NULL DEFAULT '', source_sheet text, revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,ifb)
);
CREATE UNIQUE INDEX public_tender_reference ON public_tenders(tenant_id, lower(regexp_replace(ifb,'\s','','g')));
CREATE TABLE operations_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 project_id uuid NOT NULL REFERENCES projects(id),
 kind text NOT NULL CHECK(kind IN ('inventory','labour','equipment','people','quality')),
 entry_date date NOT NULL,
 fields jsonb NOT NULL CHECK(jsonb_typeof(fields)='object'),
 request_id text NOT NULL, revision integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,kind,request_id)
);
CREATE INDEX operations_project ON operations_entries(tenant_id,project_id,kind,entry_date DESC);
CREATE UNIQUE INDEX attendance_person_date ON operations_entries(tenant_id,project_id,entry_date,lower(fields->>'employee')) WHERE kind='people';
ALTER TABLE public_tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_tenders FORCE ROW LEVEL SECURITY;
CREATE POLICY tender_tenant ON public_tenders USING(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE operations_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY operations_tenant ON operations_entries USING(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
-- Production repository writes must lock project stock rows during balance checks,
-- and update revision atomically. State changes and audit events share one transaction.
