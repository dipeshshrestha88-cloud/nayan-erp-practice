-- Company certificates retain every uploaded version; bytes belong in object storage.
CREATE TABLE company_document_versions (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 category text NOT NULL CHECK (category IN ('registration','license','municipality','pan','tax-clearance')),
 object_key text NOT NULL UNIQUE,
 file_name text NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 10485760),
 checksum char(64) NOT NULL,
 uploaded_at timestamptz NOT NULL DEFAULT now(),
 uploaded_by uuid NOT NULL REFERENCES users(id),
 UNIQUE(tenant_id,category,checksum)
);
CREATE INDEX company_document_history ON company_document_versions(tenant_id,category,uploaded_at DESC);
ALTER TABLE company_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_document_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY company_document_tenant ON company_document_versions
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
