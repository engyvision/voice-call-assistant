-- Create custom enum type only if it doesn't exist
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

-- Create the call_records table
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
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Add constraints
  CONSTRAINT valid_duration CHECK (duration >= 0),
  CONSTRAINT valid_phone_number CHECK (length(phone_number) >= 7),
  CONSTRAINT valid_recipient_name CHECK (length(trim(recipient_name)) > 0),
  CONSTRAINT valid_call_goal CHECK (length(trim(call_goal)) > 0)
);

-- Enable Row Level Security
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_records_created_at ON call_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_status ON call_records(status);
CREATE INDEX IF NOT EXISTS idx_call_records_user_id ON call_records(user_id);
CREATE INDEX IF NOT EXISTS idx_call_records_phone_number ON call_records(phone_number);

-- RLS Policies - Drop existing policies first, then recreate

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow public access to call records" ON call_records;
  DROP POLICY IF EXISTS "Users can view own call records" ON call_records;
  DROP POLICY IF EXISTS "Users can insert own call records" ON call_records;
  DROP POLICY IF EXISTS "Users can update own call records" ON call_records;
  DROP POLICY IF EXISTS "Users can delete own call records" ON call_records;
EXCEPTION
  WHEN undefined_object THEN
    -- Policy doesn't exist, continue
    NULL;
END $$;

-- Create policies
CREATE POLICY "Allow public access to call records"
  ON call_records
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own call records"
  ON call_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own call records"
  ON call_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own call records"
  ON call_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own call records"
  ON call_records
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create a function to automatically set completed_at when status changes to completed or failed
CREATE OR REPLACE FUNCTION update_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Set completed_at when status changes to completed or failed
  IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
    NEW.completed_at = now();
  END IF;
  
  -- Clear completed_at if status changes back to active states
  IF NEW.status NOT IN ('completed', 'failed') AND OLD.status IN ('completed', 'failed') THEN
    NEW.completed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update completed_at
DROP TRIGGER IF EXISTS trigger_update_completed_at ON call_records;
CREATE TRIGGER trigger_update_completed_at
  BEFORE UPDATE ON call_records
  FOR EACH ROW
  EXECUTE FUNCTION update_completed_at();

-- Sample data insertion removed to prevent reloading on every restart
-- The database schema is now clean and ready for production use