-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create development user with limited privileges
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'pos_user') THEN
    CREATE USER pos_user WITH PASSWORD 'dev_password';
  END IF;
END
$$;

-- Grant privileges
GRANT CONNECT ON DATABASE pos_dev TO pos_user;
GRANT USAGE ON SCHEMA public TO pos_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pos_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pos_user;

-- Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pos_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pos_user;