# AgriKoom Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. No organization sub-resource (`products`, `movements`, `sales`, `debtors`, `debtPayments`, `workers`, `attendance`, `cashClosings`, `auditLogs`, `members`) can exist without an existing parent `/organizations/{orgId}`.
2. Every `list` query on an organization or sub-resource enforces `resource.data.orgOwnerId == request.auth.uid || request.auth.uid in resource.data.memberUids` with zero `get()`/`exists()` inside `allow list`.
3. `auditLogs`, `movements`, `debtPayments`, and `cashClosings` are append-only: updates and non-admin deletes are denied (`auditLogs` never updatable or deletable).
4. `sales` cancellation (`status: 'completed' -> 'cancelled'`) is strictly locked to the organization owner/admin (`isOrgAdmin(orgId)`), never `manager` or `pointer`. Once `status == 'cancelled'`, no further updates are permitted.
5. All user writes require `request.auth != null && request.auth.token.email_verified == true`.
6. Document IDs are validated via `isValidId()` (`^[a-zA-Z0-9_\-]+$`, `<= 128` chars), and every string and array enforces explicit `.size()` bounds.
7. Timestamps (`createdAt`, `updatedAt`) are verified against `request.time`.

## 2. The "Dirty Dozen" Payloads (Attack Vectors)
1. **Unverified Email Spoofing**: `auth.email = "bishflix2@gmail.com"`, `email_verified = false` attempting admin read/write -> `PERMISSION_DENIED`.
2. **Self-Role Escalation**: Non-admin user updating `/organizations/{orgId}/members/{uid}` to set `role: "admin"` -> `PERMISSION_DENIED`.
3. **Ghost Field Shadow Injection**: Creating a `Product` with an extra undeclared field `isVerified: true` -> `PERMISSION_DENIED`.
4. **ID Poisoning**: Creating `/organizations/{orgId}/products/{1500_char_id}` -> `PERMISSION_DENIED`.
5. **Cross-Tenant List Scraping**: Authenticated user A listing `/organizations/org_b/debtors` -> `PERMISSION_DENIED`.
6. **PII Leak on `/users/{otherUid}`**: User A reading `/users/{userB}` -> `PERMISSION_DENIED`.
7. **Manager Deleting Sale History**: Manager/Cashier calling `delete` on `/organizations/{orgId}/sales/{saleId}` -> `PERMISSION_DENIED`.
8. **Terminal State Re-opening**: Updating a `Sale` where `existing().status == 'cancelled'` back to `'completed'` -> `PERMISSION_DENIED`.
9. **Audit Log Tampering**: Updating or deleting `/organizations/{orgId}/auditLogs/{logId}` -> `PERMISSION_DENIED`.
10. **Immortal Field Mutation**: Updating `Product` to mutate `createdAt` or `orgOwnerId` -> `PERMISSION_DENIED`.
11. **Backdated Timestamp Forgery**: Creating a `Sale` with `createdAt` forged to a past date != `request.time` -> `PERMISSION_DENIED`.
12. **Unbounded Array Bomb**: Creating an `Organization` with `memberUids` array length > 20 -> `PERMISSION_DENIED`.
