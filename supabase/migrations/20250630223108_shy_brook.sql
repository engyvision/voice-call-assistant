/*
  # Database Schema Verification and Setup

  This migration ensures the call_records table and related objects exist
  with proper configuration for the AI Call Assistant application.
  
  1. Verifies call_status enum exists
  2. Ensures call_records table has all required columns
  3. Sets up proper indexes and constraints
  4. Configures Row Level Security policies
*/

-- Verify the call_status enum exists (it should already exist based on your schema)
-- If it doesn't exist, this will create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_status') THEN
        CREATE TYPE call_status AS ENUM (
          'idle',
          'preparing', 
          'dialing',
          'in-progress',
          'completed',
          'failed'
        );
    END IF;
END $$;

-- Ensure the call_records table exists with all required columns
-- Based on your schema, this table should already exist
CREATE TABLE IF NOT EXISTS call_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_name text NOT NULL,
  phone_number text NOT NULL,
  call_goal text NOT NULL,
  additional_context text DEFAULT '',
  status call_status NOT NULL DEFAULT 'preparing',
  result_success boolean,
  result_message text,
  result_details text,
  result_transcript text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration integer DEFAULT 0,
  user_id uuid
);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'call_records_user_id_fkey'
    ) THEN
        ALTER TABLE call_records 
        ADD CONSTRAINT call_records_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure Row Level Security is enabled
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;

-- Create indexes if they don't exist (based on your existing schema)
CREATE INDEX IF NOT EXISTS idx_call_records_created_at ON call_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_status ON call_records(status);
CREATE INDEX IF NOT EXISTS idx_call_records_user_id ON call_records(user_id);
CREATE INDEX IF NOT EXISTS idx_call_records_phone_number ON call_records(phone_number);

-- Ensure the update_completed_at function exists
CREATE OR REPLACE FUNCTION update_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed') AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'failed')) THEN
    NEW.completed_at = now();
  END IF;
  
  IF NEW.status NOT IN ('completed', 'failed') AND OLD.status IN ('completed', 'failed') THEN
    NEW.completed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_update_completed_at ON call_records;
CREATE TRIGGER trigger_update_completed_at
  BEFORE UPDATE ON call_records
  FOR EACH ROW
  EXECUTE FUNCTION update_completed_at();

-- Verify RLS policies exist (based on your existing schema)
-- These should already exist, but we'll ensure they're properly configured

-- Drop and recreate the public access policy
DROP POLICY IF EXISTS "Allow public access to call records" ON call_records;
CREATE POLICY "Allow public access to call records"
  ON call_records
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Drop and recreate user-specific policies
DROP POLICY IF EXISTS "Users can view own call records" ON call_records;
CREATE POLICY "Users can view own call records"
  ON call_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own call records" ON call_records;
CREATE POLICY "Users can insert own call records"
  ON call_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own call records" ON call_records;
CREATE POLICY "Users can update own call records"
  ON call_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own call records" ON call_records;
CREATE POLICY "Users can delete own call records"
  ON call_records
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);