-- NULL preserves recorded break events; explicit totals retain original events for audit.
ALTER TABLE workforce_shifts ADD COLUMN break_minutes_override INTEGER
  CHECK (break_minutes_override IS NULL OR (typeof(break_minutes_override) = 'integer' AND break_minutes_override >= 0));
