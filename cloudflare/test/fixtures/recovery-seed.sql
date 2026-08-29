PRAGMA foreign_keys = ON;

INSERT INTO workforce_organizations (id, name, timezone)
VALUES ('org-recovery-test', 'Synthetic Recovery Org', 'UTC');

INSERT INTO workforce_users
  (id, email, password_salt, password_hash, password_iterations, must_change_password)
VALUES
  ('user-recovery-admin', 'admin@recovery.invalid', '00000000000000000000000000000000', '0000000000000000000000000000000000000000000000000000000000000000', 100000, 0),
  ('user-recovery-worker', 'worker@recovery.invalid', '11111111111111111111111111111111', '1111111111111111111111111111111111111111111111111111111111111111', 100000, 0);

INSERT INTO workforce_memberships (organization_id, user_id, role, display_name)
VALUES
  ('org-recovery-test', 'user-recovery-admin', 'admin', 'Synthetic Admin'),
  ('org-recovery-test', 'user-recovery-worker', 'worker', 'Synthetic Worker');

INSERT INTO workforce_projects
  (id, organization_id, name, code, address, latitude, longitude, radius_m, is_active, description)
VALUES
  ('project-recovery-test', 'org-recovery-test', 'Synthetic Site', 'REC-001', 'Synthetic address', 0, 0, 200, 1, 'Recovery rehearsal only');

INSERT INTO workforce_shifts
  (id, organization_id, user_id, state, clock_in_at, work_date, project_id)
VALUES
  ('shift-recovery-test', 'org-recovery-test', 'user-recovery-worker', 'working', '2026-01-15T08:00:00.000Z', '2026-01-15', 'project-recovery-test');

INSERT INTO workforce_shift_events
  (id, organization_id, shift_id, user_id, event_type, occurred_at, latitude, longitude, accuracy_m, idempotency_key)
VALUES
  ('event-recovery-in', 'org-recovery-test', 'shift-recovery-test', 'user-recovery-worker', 'clock_in', '2026-01-15T08:00:00.000Z', 0, 0, 10, 'recovery-clock-in');

UPDATE workforce_shifts
SET state = 'on_break', break_started_at = '2026-01-15T12:00:00.000Z'
WHERE id = 'shift-recovery-test';

INSERT INTO workforce_shift_events
  (id, organization_id, shift_id, user_id, event_type, occurred_at, latitude, longitude, accuracy_m, idempotency_key)
VALUES
  ('event-recovery-break-start', 'org-recovery-test', 'shift-recovery-test', 'user-recovery-worker', 'start_break', '2026-01-15T12:00:00.000Z', 0, 0, 10, 'recovery-break-start');

UPDATE workforce_shifts
SET state = 'working', break_ended_at = '2026-01-15T12:30:00.000Z'
WHERE id = 'shift-recovery-test';

INSERT INTO workforce_shift_events
  (id, organization_id, shift_id, user_id, event_type, occurred_at, latitude, longitude, accuracy_m, idempotency_key)
VALUES
  ('event-recovery-break-end', 'org-recovery-test', 'shift-recovery-test', 'user-recovery-worker', 'end_break', '2026-01-15T12:30:00.000Z', 0, 0, 10, 'recovery-break-end');

UPDATE workforce_shifts
SET state = 'complete', clock_out_at = '2026-01-15T16:30:00.000Z'
WHERE id = 'shift-recovery-test';

INSERT INTO workforce_shift_events
  (id, organization_id, shift_id, user_id, event_type, occurred_at, latitude, longitude, accuracy_m, idempotency_key)
VALUES
  ('event-recovery-out', 'org-recovery-test', 'shift-recovery-test', 'user-recovery-worker', 'clock_out', '2026-01-15T16:30:00.000Z', 0, 0, 10, 'recovery-clock-out');

INSERT INTO workforce_google_identities (user_id, google_subject, google_email)
VALUES ('user-recovery-worker', 'synthetic-google-subject', 'worker@recovery.invalid');

INSERT INTO workforce_payroll_profiles
  (user_id, organization_id, legal_name, address, employee_number, social_security_ciphertext,
   tax_reference_ciphertext, social_reference_ciphertext, itis_rate_bps, status, reviewed_at, reviewed_by)
VALUES
  ('user-recovery-worker', 'org-recovery-test', 'Synthetic Worker', 'Synthetic address', 'REC-001',
   'synthetic-ciphertext', 'synthetic-ciphertext', 'synthetic-ciphertext', 1500, 'approved',
   '2026-01-16T10:00:00.000Z', 'user-recovery-admin');

INSERT INTO workforce_payroll_settings
  (organization_id, hourly_rate_pence, pay_frequency, pay_day, business_name, business_address,
   worker_social_security_rate_bps, employer_social_security_rate_bps, updated_at, updated_by)
VALUES
  ('org-recovery-test', 2000, 'monthly', 25, 'Synthetic Business', 'Synthetic address',
   600, 650, '2026-01-16T10:00:00.000Z', 'user-recovery-admin');

INSERT INTO workforce_payroll_runs
  (id, organization_id, period_start, period_end, pay_date, status, gross_pay_pence,
   worker_social_security_pence, income_tax_pence, net_pay_pence,
   employer_social_security_pence, employer_total_cost_pence, submitted_at, reviewed_at, reviewed_by)
VALUES
  ('payroll-recovery-test', 'org-recovery-test', '2026-01-01', '2026-01-31', '2026-01-25', 'approved',
   16000, 960, 2400, 12640, 1040, 17040, '2026-01-20T10:00:00.000Z',
   '2026-01-20T11:00:00.000Z', 'user-recovery-admin');

INSERT INTO workforce_payroll_run_lines
  (payroll_run_id, user_id, display_name, email, employee_number, profile_status, shift_count,
   net_minutes, itis_rate_bps, gross_pay_pence, worker_social_security_pence, income_tax_pence,
   net_pay_pence, employer_social_security_pence, employer_total_cost_pence)
VALUES
  ('payroll-recovery-test', 'user-recovery-worker', 'Synthetic Worker', 'worker@recovery.invalid',
   'REC-001', 'approved', 1, 480, 1500, 16000, 960, 2400, 12640, 1040, 17040);

INSERT INTO workforce_audit_events
  (organization_id, actor_user_id, action, subject_id, metadata_json)
VALUES
  ('org-recovery-test', 'user-recovery-admin', 'recovery.synthetic.seeded', 'shift-recovery-test', '{"synthetic":true}');
