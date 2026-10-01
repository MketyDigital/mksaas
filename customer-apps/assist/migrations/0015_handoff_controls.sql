ALTER TABLE customers ADD COLUMN automation_paused INTEGER NOT NULL DEFAULT 0 CHECK (automation_paused IN (0,1));
ALTER TABLE assistants ADD COLUMN automation_paused INTEGER NOT NULL DEFAULT 0 CHECK (automation_paused IN (0,1));
ALTER TABLE conversations ADD COLUMN automation_paused INTEGER NOT NULL DEFAULT 0 CHECK (automation_paused IN (0,1));
ALTER TABLE conversations ADD COLUMN handoff_assignee_user_id TEXT;
ALTER TABLE conversations ADD COLUMN handoff_note TEXT;
