# Payroll profile (Jersey)

The payroll profile is a one-time worker-submitted record for the business owner to review before payroll is calculated.

## Data collected

- Legal name, home address and employee number.
- Tax Reference (ITIS) and Social Security Number. The legacy duplicate social-security field is no longer requested from workers.
- ITIS percentage, stored as basis points so values such as `15.25%` are exact.
- Optional bank account name, sort code and account number.

The API accepts ITIS from `0` to `100` with a maximum of two decimal places. It does not infer or calculate a Jersey tax rate; the rate remains an explicit worker-provided value until the Jersey payroll rules are validated and the administrator configures the payroll policy.

## Protection model

- Social security, tax, social-reference and bank fields are encrypted with AES-256-GCM before entering D1.
- `PAYROLL_ENCRYPTION_KEY` must be a 32-byte secret encoded as 64 hexadecimal characters or base64url. It must not be committed to Git or placed in the frontend.
- Worker and admin list responses only expose masked indicators for encrypted fields.
- Full sensitive values are returned only by the admin `reveal` endpoint, which requires the admin session plus CSRF and writes `payroll.profile.viewed` to the audit log.
- Saving a worker profile resets its review status to `pending_review`; an admin can approve it or request changes.

## Migration and rollback

Migration: `cloudflare/migrations/0006_payroll_profiles.sql`.

Before applying it to production, make a verified D1 backup and configure the encryption secret. The manual rollback is to drop `workforce_payroll_profiles` only after an explicit operator decision and a verified backup; this permanently removes submitted payroll profiles.
