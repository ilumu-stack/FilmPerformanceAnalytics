-- FilmIQ PostgreSQL initialization
-- Runs once when the container is first created.

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- for full-text search on movie titles

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE filmiq TO filmiq_user;

-- Create full-text search index helper function (used post-migration)
-- Actual table indexes are created by Alembic migrations.
