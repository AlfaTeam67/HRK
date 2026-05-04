# RBAC + ABAC in HRK Backend

This document describes the authorization model implemented for ALF-60.

## 1) Authorization model

HRK uses a hybrid model:

- RBAC (role-based): what a user can do.
- ABAC (attribute-based scope): where a user can do it.

Identity and authorization are intentionally separated:

- Active Directory provides identity (`login`).
- CRM stores permissions locally (`user_roles`, `user_company_access`, `user_contract_access`).

## 2) Data model

- `users`: identity only (`id`, `login`, `email`).
- `user_roles`: many-to-many user->role assignments.
- `user_company_access`: user scope for company-level resources.
- `user_contract_access`: optional user scope for contract-level resources.

If no explicit role assignment exists, effective role defaults to `viewer`.

## 3) Roles

- `admin`
- `manager`
- `account_manager`
- `consultant`
- `viewer`

Role rank (lowest->highest):

`viewer < consultant < manager ~= account_manager < admin`

## 4) Policy matrix

Implemented matrix in `AuthorizationService.POLICY_MATRIX`:

- `company.read` -> `viewer`
- `company.update` -> `manager`
- `document.read` -> `viewer`
- `document.upload` -> `consultant`
- `document.delete` -> `manager`
- `rag.query` -> `viewer`
- `access.manage` -> `admin`

## 5) Enforcement flow

`AuthorizationService.authorize()` performs:

1. role resolution (`user_roles`, fallback to `viewer`),
2. admin bypass,
3. scope verification (`company_id` and/or `contract_id`),
4. minimum-role verification for action.

If denied, API returns `403` with:

```json
{
  "code": "AUTHORIZATION_DENIED",
  "message": "..."
}
```

## 6) Endpoint coverage

- Global auth (`get_current_user`) is attached to non-auth routers in:
  - `src/app/api/v1/__init__.py`
  - `src/app/api/__init__.py`
- `companies` endpoints enforce RBAC+ABAC.
- `documents` endpoints enforce RBAC+ABAC via service layer.
- `rag/search` enforces scope by `customer.company_id`.
- `users` and `access` management endpoints are admin-only (`require_admin`).

## 7) Access management API

Admin endpoints:

- `GET /api/v1/access/users/{user_id}`
- `PUT /api/v1/access/users/{user_id}/roles`
- `PUT /api/v1/access/users/{user_id}/companies`
- `PUT /api/v1/access/users/{user_id}/contracts`

These endpoints are the operational interface for assigning RBAC/ABAC policies.

## 8) Docker verification procedure

From `backend/`:

```bash
make docker-up
make docker-migrate
make test-docker
```

Minimum expected outcome:

- authorization tests pass for deny/allow scenarios,
- no endpoint is accessible without authentication (except `/api/v1/auth/*`),
- admin-only routes (`/api/v1/users/*`, `/api/v1/access/*`) deny non-admin users.

## 9) Known operational note

If `user_roles` migration is not applied in the current DB, role assignment tests may be skipped/fallback to `viewer`. In Docker validation for ALF-60, always run migrations before tests.
