# Construction ERP redesign research

Date: 2026-09-08

Scope: Nepal-focused contractor ERP interaction design, with special attention to integrating bank guarantees inside Finance & Compliance.

## Decision

The implementation uses one shared application shell and places Bank Guarantees inside Finance & Compliance. Finance groups client bills, vendor payables, VAT/TDS and guarantees because these records affect cash, commitments and project control together.

## Evidence

- [Oracle Primavera Unifier project controls](https://www.oracle.com/construction-engineering/primavera-unifier-project-controls-asset-management/) describes connected budgets, contracts, changes, funding, cash flow, approvals and operations as a unified workflow-driven platform.
- [Oracle Unifier cost management levels](https://docs.oracle.com/en/industries/construction-engineering/primavera-unifier/26/udesigner/costmanagementlevels-77650a.html) explains that costs, contracts, change orders and payment applications roll into a project/company cost sheet and cash flow view.
- [Oracle contract business process](https://docs.oracle.com/en/industries/construction-engineering/primavera-unifier/26/accelerator-user/contractbusinessprocess-10296626a.html) documents required contract records, vendor relationships, cost information and review/approval workflow states.
- [Bidhee Construction ERP](https://bidhee.com/products/construction-management-system) identifies the Nepal-market baseline modules: project/BOQ, procurement, warehouse, equipment, HR/payroll, bank guarantees and tracking.
- [Procore General Contractor Financial Management guide](https://support.procore.com/products/online/financial-management-user-guides/general-contractor-financial-management-user-guide) and [Autodesk Construction Cost Management](https://construction.autodesk.com/workflows/construction-cost-management/) were used as comparative workflow benchmarks for connected cost, commitment, billing, change and forecasting controls.

## Implementation implications

1. Use accurate zero states until operational records exist; do not show synthetic portfolio numbers.
2. Treat guarantees as finance records with utilization, expiry and lifecycle visibility rather than a detached spreadsheet page.
3. Keep Project → procurement → vendor bill → cost and Project → progress → running bill → receipt as explicit first-use flows.
4. Production deployment still needs database-backed identity, roles/approval thresholds, controlled documents, immutable audit detail, and CA/IRD validation of statutory tax use.
