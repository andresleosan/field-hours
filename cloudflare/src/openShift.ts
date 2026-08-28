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
