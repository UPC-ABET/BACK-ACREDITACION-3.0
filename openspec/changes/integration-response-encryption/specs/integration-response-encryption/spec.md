# Per-Integration Response Encryption Specification

## Purpose

Defines a per-`api_tokens`-row symmetric encryption key, admin-managed, and an opt-in mechanism
(`@EncryptedResponse()`) that encrypts a route's JSON response body for a resolved machine caller,
so that each external system consuming this API can only decrypt the responses addressed to it.

## Requirements

### Requirement: Per-Integration Key Issuance and Rotation

The system MUST allow an admin to issue exactly one encryption key per `api_tokens` row, MUST
return the plaintext key exactly once (at issuance or at rotation), and MUST NOT make the plaintext
retrievable through any other endpoint afterwards.

#### Scenario: Issuing a key for a token that has none

- GIVEN an active `api_tokens` row with no `integration_keys` row yet
- WHEN an admin issues a key for it
- THEN a new key is generated, stored encrypted at rest, and its plaintext is returned once in the response

#### Scenario: Issuing a second key for the same token is rejected

- GIVEN an `api_tokens` row that already has an `integration_keys` row
- WHEN an admin attempts to issue another key for the same `apiTokenId`
- THEN the request is rejected as a conflict, and the existing key is untouched

#### Scenario: Rotating replaces the key and invalidates the old one

- GIVEN an `api_tokens` row with an existing `integration_keys` row
- WHEN an admin rotates its key
- THEN a new plaintext key is returned once, the stored ciphertext is replaced, and the previous key can no longer decrypt future responses

#### Scenario: Plaintext key is never returned by read endpoints

- GIVEN an issued `integration_keys` row
- WHEN it is read via a list or get-by-token endpoint
- THEN the response contains no plaintext or ciphertext key material

### Requirement: Opt-In Response Encryption for Machine Callers

The system MUST encrypt a route's `data` field only when the route carries `@EncryptedResponse()`
and the request was authenticated as a machine principal, and MUST leave every other response
byte-identical to today's plaintext envelope.

#### Scenario: Machine caller on an encrypted route receives ciphertext

- GIVEN a route carrying both `@ApiTokenAuth()` and `@EncryptedResponse()`, and a valid `X-Api-Key` whose integration key is provisioned
- WHEN the request succeeds
- THEN the response `data` field is a string in `ivHex:encryptedHex:authTagHex` format, decryptable with that integration's key into the original JSON payload

#### Scenario: Human caller on the same encrypted route is unaffected

- GIVEN the same route as above, called with a human JWT/cookie session instead of `X-Api-Key`
- WHEN the request succeeds
- THEN the response `data` field is the original plaintext object, unchanged

#### Scenario: Route without the decorator is never encrypted

- GIVEN a route that does not carry `@EncryptedResponse()`
- WHEN any caller (human or machine) hits it successfully
- THEN the response `data` field is unchanged plaintext

#### Scenario: Errors are never encrypted

- GIVEN a route carrying `@EncryptedResponse()`
- WHEN a request to it fails with any exception
- THEN the error response follows the existing `AllExceptionsFilter` envelope unchanged, with no encryption applied

### Requirement: Fail-Closed on Missing Key Provisioning

The system MUST reject, rather than silently return plaintext or a malformed response, a request to
an `@EncryptedResponse()` route made by a machine principal whose token has no provisioned
integration key.

#### Scenario: Encrypted route hit by a token with no key

- GIVEN a route carrying `@EncryptedResponse()`, and a valid, authorized `X-Api-Key` whose `apiTokenId` has no `integration_keys` row
- WHEN the request would otherwise succeed
- THEN the system responds with a server error and never returns the handler's plaintext payload
