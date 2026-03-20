-- course: add capacity and waitlist config
ALTER TABLE course
  ADD COLUMN max_capacity INTEGER,           -- NULL = no limit
  ADD COLUMN waitlist_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Enforce: waitlist only makes sense when there is a capacity cap
  ADD CONSTRAINT waitlist_requires_capacity
    CHECK (max_capacity IS NOT NULL OR waitlist_enabled = false);

-- groupmember: add enrollment status
-- TEXT + CHECK intentionally used over a Postgres ENUM to keep the migration
-- simple; adding a third status later requires only a CHECK constraint change.
ALTER TABLE groupmember
  ADD COLUMN status TEXT NOT NULL DEFAULT 'enrolled'
  CHECK (status IN ('enrolled', 'waitlisted'));

-- Index for capacity count query (group_id FK index exists; role_id + status do not)
CREATE INDEX idx_groupmember_group_role_status
  ON groupmember (group_id, role_id, status);
