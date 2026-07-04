CREATE INDEX IF NOT EXISTS idx_jobs_group_status ON jobs(group_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_poster ON jobs(poster_id);
CREATE INDEX IF NOT EXISTS idx_job_claims_claimed_by ON job_claims(claimed_by);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group ON user_groups(group_id);
