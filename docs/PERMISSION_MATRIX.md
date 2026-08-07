# Permission Matrix

Source of truth: `backend/src/constants/permissions.js` + `rolePermissions.js`.

## Roles

| Role | Scope summary |
|---|---|
| OWNER | All module wildcards + `dashboard.view` + audit |
| ADMIN | Near-full clinic ops; roles view/manage |
| BRANCH_MANAGER | Branch ops, clinical view, reports view/export/schedule, CRM, notifications |
| DOCTOR | Patients/appointments clinical, EMR, Rx, plans, sessions, reports.view, dashboard.view, queue |
| RECEPTIONIST | Patients, appointments all, reception/queue, billing create/pay, CRM follow-up |
| NURSE | Clinical view/edit, consultation edit, limited Rx/plan view, queue view |
| TECHNICIAN | Treatment sessions, inventory view/adjust |
| CASHIER | Billing all, reports.view |
| PHARMACIST | Pharmacy/inventory/purchase all, Rx view/print |
| CRM_EXECUTIVE | CRM all, limited patients/appointments, reports.view |

## Sensitive permissions

| Permission | Typical holders |
|---|---|
| `billing.refund` | Admin/Owner (+ billing.*) |
| `billing.finalize` | Admin, cashier (`billing.*`), managers |
| `stock.adjust` | Pharmacist, technician, admin |
| `reports.export` | Managers, admin, owner |
| `dashboard.view` | Owner, admin, branch manager, doctor |
| `roles.manage` | Admin, owner |
| `users.delete` | Admin/owner (`users.*`) |
| `patients.merge` | Admin/owner |

## Wildcards

- `module.*` grants all keys under that module  
- Owner effective permissions include `*` at login  

## Verification

```bash
npm run smoke:regression
# + backend/tests/permissions/rbac.matrix.test.js (skeleton)
```
