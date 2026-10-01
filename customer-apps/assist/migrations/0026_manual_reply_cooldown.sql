ALTER TABLE assistants ADD COLUMN manual_reply_pause_seconds INTEGER NOT NULL DEFAULT 900;
ALTER TABLE conversations ADD COLUMN automation_resume_at INTEGER;
ALTER TABLE conversations ADD COLUMN automation_pause_reason TEXT;
