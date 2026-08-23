import { requireRole } from "./auth";
import type { AuthContext } from "./types";

export interface RequestHistoryItem {
  id: string;
  category: "google" | "password_reset";
  requestType: string;
  email: string;
  displayName: string;
  status: string;
  reason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewerName: string | null;
}

interface HistoryRow extends Omit<RequestHistoryItem, "category"> {
  category: "google" | "password_reset";
}

export async function listRequestHistory(
  env: Env,
  auth: AuthContext,
): Promise<RequestHistoryItem[]> {
  requireRole(auth, "admin");
  const [google, passwordReset] = await Promise.all([
    env.DB.prepare(
      `SELECT r.id, 'google' AS category, r.request_type AS requestType,
              r.email, r.display_name AS displayName, r.status,
              r.rejection_reason AS reason, r.requested_at AS requestedAt,
              r.reviewed_at AS reviewedAt, reviewer.display_name AS reviewerName
       FROM workforce_auth_requests r
       LEFT JOIN workforce_memberships reviewer
         ON reviewer.organization_id = r.organization_id AND reviewer.user_id = r.reviewed_by
       WHERE r.organization_id = ?1 AND r.status <> 'pending'
       ORDER BY COALESCE(r.reviewed_at, r.requested_at) DESC LIMIT 100`,
    ).bind(auth.user.organizationId).all<HistoryRow>(),
    env.DB.prepare(
      `SELECT r.id, 'password_reset' AS category, 'password_reset' AS requestType,
              r.email, m.display_name AS displayName, r.status,
              (
                SELECT json_extract(a.metadata_json, '$.reason')
                FROM workforce_audit_events a
                WHERE a.organization_id = r.organization_id
                  AND a.subject_id = r.user_id
                  AND a.action = 'account.password.reset_rejected'
                  AND a.created_at >= r.requested_at
                ORDER BY a.id DESC LIMIT 1
              ) AS reason,
              r.requested_at AS requestedAt, r.reviewed_at AS reviewedAt,
              reviewer.display_name AS reviewerName
       FROM workforce_password_reset_requests r
       JOIN workforce_memberships m
         ON m.organization_id = r.organization_id AND m.user_id = r.user_id
       LEFT JOIN workforce_memberships reviewer
         ON reviewer.organization_id = r.organization_id AND reviewer.user_id = r.reviewed_by
       WHERE r.organization_id = ?1 AND r.status <> 'pending'
       ORDER BY COALESCE(r.reviewed_at, r.requested_at) DESC LIMIT 100`,
    ).bind(auth.user.organizationId).all<HistoryRow>(),
  ]);
  return [...google.results, ...passwordReset.results]
    .sort((left, right) => {
      const leftDate = new Date(left.reviewedAt ?? left.requestedAt).getTime();
      const rightDate = new Date(right.reviewedAt ?? right.requestedAt).getTime();
      return rightDate - leftDate;
    })
    .slice(0, 200);
}
