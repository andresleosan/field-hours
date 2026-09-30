import type { ShiftState } from "./types";

export interface OpenShiftRow {
  id: string;
  state: Exclude<ShiftState, "off_shift">;
  clockInAt: string;
  breakStartedAt: string | null;
  breakEndedAt: string | null;
  clockOutAt: string | null;
  projectId: string | null;
  projectName: string | null;
}

/**
 * Returns the worker's single open shift regardless of its work date.
 *
 * The database enforces one open shift per organization/worker. Deliberately
 * avoiding a work-date filter keeps an overnight or forgotten shift actionable
 * after midnight instead of leaving it open but unreachable.
 */
export async function findOpenShiftForWorker(
  db: D1Database,
  organizationId: string,
  userId: string,
): Promise<OpenShiftRow | null> {
  return db.prepare(
    `SELECT
       s.id,
       s.state,
       s.clock_in_at AS clockInAt,
       s.break_started_at AS breakStartedAt,
       s.break_ended_at AS breakEndedAt,
       s.clock_out_at AS clockOutAt,
       s.project_id AS projectId,
       p.name AS projectName
     FROM workforce_shifts s
     LEFT JOIN workforce_projects p
       ON p.id = s.project_id AND p.organization_id = s.organization_id
     WHERE s.organization_id = ?1
       AND s.user_id = ?2
       AND s.state <> 'complete'
     ORDER BY s.clock_in_at DESC
     LIMIT 1`,
  ).bind(organizationId, userId).first<OpenShiftRow>();
}

/** Shifts left open this long are closed automatically at clock-in + 24h. */
export const MAX_SHIFT_HOURS = 24;

/**
 * Closes every shift still open 24 hours after clock-in, with clock-out exactly at
 * clock-in + 24h. Idempotent; runs on reads/clock actions and from the cron trigger.
 * No clock_out event is written: events require GPS evidence the worker never gave.
 */
export async function closeExpiredShifts(db: D1Database, now = Date.now()): Promise<void> {
  const cutoff = new Date(now - MAX_SHIFT_HOURS * 3_600_000).toISOString();
  const end = `strftime('%Y-%m-%dT%H:%M:%fZ', clock_in_at, '+${MAX_SHIFT_HOURS} hours')`;
  const expired = "state <> 'complete' AND clock_in_at <= ?1";
  await db.batch([
    db.prepare(
      `INSERT INTO workforce_audit_events (organization_id, actor_user_id, action, subject_id, metadata_json)
       SELECT organization_id, 'system', 'shift.auto_closed', id,
              json_object('reason', 'No clock-out within ${MAX_SHIFT_HOURS} hours', 'clock_out', ${end}, 'state', state)
       FROM workforce_shifts WHERE ${expired}`,
    ).bind(cutoff),
    db.prepare(
      `UPDATE workforce_shifts
       SET state = 'complete',
           clock_out_at = ${end},
           break_started_at = CASE WHEN break_started_at > ${end} THEN NULL ELSE break_started_at END,
           break_ended_at = CASE
             WHEN break_started_at IS NULL OR break_started_at > ${end} THEN NULL
             WHEN break_ended_at IS NULL OR break_ended_at > ${end} THEN ${end}
             ELSE break_ended_at END
       WHERE ${expired}`,
    ).bind(cutoff),
  ]);
}
