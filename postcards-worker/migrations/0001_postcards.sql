CREATE TABLE IF NOT EXISTS postcards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 60),
  city TEXT NOT NULL DEFAULT '' CHECK(length(city) <= 80),
  message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS postcards_public ON postcards(status, created_at DESC);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(expires_at);
