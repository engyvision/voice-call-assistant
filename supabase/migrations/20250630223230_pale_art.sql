/*
  # Database Schema Verification

  This migration ensures the call_records table and related components exist.
  Based on the existing schema, most components should already be present.
*/

-- Ensure call_status enum exists
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

-- Ensure call_records table exists
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

-- Add foreign key constraint if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'call_records_user_id_fkey'
        AND table_name = 'call_records'
    ) THEN
        ALTER TABLE call_records 
        ADD CONSTRAINT call_records_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        -- Ignore if auth.users doesn't exist yet
        NULL;
END $$;

-- Add constraints if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'valid_duration'
    ) THEN
        ALTER TABLE call_records ADD CONSTRAINT valid_duration CHECK (duration >= 0);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'valid_phone_number'
    ) THEN
        ALTER TABLE call_records ADD CONSTRAINT valid_phone_number CHECK (length(phone_number) >= 7);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'valid_recipient_name'
    ) THEN
        ALTER TABLE call_records ADD CONSTRAINT valid_recipient_name CHECK (length(trim(recipient_name)) > 0);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'valid_call_goal'
    ) THEN
        ALTER TABLE call_records ADD CONSTRAINT valid_call_goal CHECK (length(trim(call_goal)) > 0);
    END IF;
EXCEPTION
    WHEN others THEN
        -- Constraints might already exist
        NULL;
END $$;

-- Enable RLS
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_call_records_created_at ON call_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_status ON call_records(status);
CREATE INDEX IF NOT EXISTS idx_call_records_user_id ON call_records(user_id);
CREATE INDEX IF NOT EXISTS idx_call_records_phone_number ON call_records(phone_number);

-- Create trigger function
CREATE OR REPLACE FUNCTION update_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed') AND (OLD IS NULL OR OLD.status NOT IN ('completed', 'failed')) THEN
    NEW.completed_at = now();
  END IF;
  
  IF NEW.status NOT IN ('completed', 'failed') AND OLD IS NOT NULL AND OLD.status IN ('completed', 'failed') THEN
    NEW.completed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_completed_at ON call_records;
CREATE TRIGGER trigger_update_completed_at
  BEFORE UPDATE ON call_records
  FOR EACH ROW
  EXECUTE FUNCTION update_completed_at();

-- Create RLS policies
DROP POLICY IF EXISTS "Allow public access to call records" ON call_records;
CREATE POLICY "Allow public access to call records"
  ON call_records
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

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