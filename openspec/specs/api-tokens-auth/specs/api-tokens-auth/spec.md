# API Token Authentication Specification

## Purpose

Defines a generic, opt-in, machine-to-machine credential (opaque API key) that
external systems can present via `X-Api-Key` to authenticate against routes
explicitly opted in with `@ApiTokenAuth()`, authorized through the existing
`@RequirePermission` mechanism, admin-issued and admin-revocable.

## Requirements

### Requirement: Opt-In Token Authentication

The system MUST authenticate a request bearing a valid, active, unexpired
`X-Api-Key` token against a route carrying `@ApiTokenAuth()`, and MUST leave
every other route's behavior byte-identical to the pre-existing JWT-only flow.

#### Scenario: Valid token authorizes an opted-in route

- GIVEN an active, unexpired token whose scopes satisfy the route's `@RequirePermission`
- WHEN it is presented as `X-Api-Key` to a route carrying `@ApiTokenAuth()`
- THEN the request is authorized without any JWT

#### Scenario: Absent header leaves existing routes unchanged

- GIVEN a request with no `X-Api-Key` header
- WHEN it hits any route
- THEN behavior is unchanged: the JWT flow, `@Public()`, and `@SkipPermissions()` all behave exactly as before this change

#### Scenario: Valid token rejected on a non-opted-in route

- GIVEN a valid, active token
- WHEN it is presented to a route that does not carry `@ApiTokenAuth()`
- THEN the request is rejected and the token grants no access to that route

### Requirement: Scope-Based Authorization for Machine Principals

The system MUST authorize a machine principal's request using the same
`@RequirePermission` check applied to human callers, MUST reject a request
whose token scopes do not cover the route's `{module, action}` as Forbidden,
and MUST NOT apply the `isAdmin` short-circuit to a machine principal.

#### Scenario: Insufficient scope is rejected as Forbidden

- GIVEN a token whose scopes do not include the route's `{module, action}`
- WHEN it is presented to an opted-in route
- THEN the request is rejected as Forbidden, not Unauthorized

#### Scenario: isAdmin short-circuit does not apply to machine principals

- GIVEN an API-token principal reaching `PermissionsGuard`
- WHEN authorization is evaluated
- THEN the `isAdmin` short-circuit does not apply to it, and `@CurrentUser()` never receives a machine principal

### Requirement: Revocation and Expiry Enforcement

The system MUST reject a revoked (`isActive = false`) or past-expiry token,
and the rejection MUST be indistinguishable to the caller from presenting an
unknown key.

#### Scenario: Revoked or expired token is rejected

- GIVEN a revoked or past-expiry token
- WHEN it is presented on any route
- THEN the request is rejected with a response indistinguishable from an unknown `keyId`

### Requirement: One-Time Secret Disclosure at Issuance

The system MUST return the plaintext secret exactly once, in the issuance
response, and MUST NOT surface it in any later read, list, log, or error. The
persisted column MUST hold only a bcrypt hash.

#### Scenario: Secret is disclosed once and never again

- GIVEN a successful token issuance
- WHEN the admin endpoint responds
- THEN the plaintext secret appears in that response exactly once, no later read/list/log/error surfaces it, and the stored column holds only a bcrypt hash

### Requirement: Issuance and Revocation Attribution

The system MUST record which admin user issued a token and, upon revocation,
which admin user revoked it and when.

#### Scenario: Issued and revoked tokens carry attribution

- GIVEN an issued or revoked token
- WHEN the row is inspected
- THEN it records the issuing user, and if revoked, the revoking user and revocation timestamp

### Requirement: Scope Vocabulary Validation at Issuance

The system MUST reject token issuance whose requested scopes reference a
module or action outside `PERMISSION_MODULES` / `PERMISSION_ACTIONS`.

#### Scenario: Unknown module or action is rejected at issuance

- GIVEN scopes referencing a module or action outside `PERMISSION_MODULES` / `PERMISSION_ACTIONS`
- WHEN issuance is attempted
- THEN the request is rejected at validation and no token is created

### Requirement: Admin-Gated Token Management

The system MUST gate every token management endpoint (issue, list, revoke)
behind the existing ADMIN permission check, with no partial effect on
rejection.

#### Scenario: Unauthorized caller is rejected with no partial effect

- GIVEN a caller without the required admin permission
- WHEN they call any token management endpoint
- THEN the request is rejected by the existing permission guard and no token state changes

### Requirement: Bounded-Cost Token Resolution

The system MUST resolve a presented token by loading exactly one candidate
row via an indexed `keyId` lookup and performing at most one bcrypt
comparison.

#### Scenario: Authentication performs a single lookup and single comparison

- GIVEN a presented token
- WHEN it is resolved for authentication
- THEN exactly one candidate row is loaded by `keyId`, and at most one bcrypt comparison is performed
