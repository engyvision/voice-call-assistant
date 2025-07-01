/*
  # Create call records table and related functionality

  1. New Tables
    - `call_records`
      - `id` (uuid, primary key)
      - `recipient_name` (text, required)
      - `phone_number` (text, required)
      - `call_goal` (text, required)
      - `additional_context` (text, optional)
      - `status` (enum: idle, preparing, dialing, in-progress, completed, failed)
      - `result_success` (boolean, nullable)
      - `result_message` (text, nullable)
      - `result_details` (text, nullable)
      - `result_transcript` (text, nullable)
      - `created_at` (timestamp with timezone)
      - `completed_at` (timestamp with timezone, nullable)
      - `duration` (integer, default 0)
      - `user_id` (uuid, foreign key to auth.users)

  2. Security
    - Enable RLS on `call_records` table
    - Add policies for authenticated users to manage their own records
    - Add public access policy for testing

  3. Performance
    - Add indexes for common queries
    - Add constraints for data validation

  4. Automation
    - Add trigger to automatically set completed_at timestamp
*/

-- Create the call_status enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE call_status AS ENUM (
      'idle',
      'preparing', 
      'dialing',
      'in-progress',
      'completed',
      'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the call_records table if it doesn't exist
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
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add table constraints if they don't exist
DO $$ BEGIN
    ALTER TABLE call_records ADD CONSTRAINT valid_duration CHECK (duration >= 0);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE call_records ADD CONSTRAINT valid_phone_number CHECK (length(phone_number) >= 7);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE call_records ADD CONSTRAINT valid_recipient_name CHECK (length(trim(recipient_name)) > 0);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE call_records ADD CONSTRAINT valid_call_goal CHECK (length(trim(call_goal)) > 0);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enable Row Level Security
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;

-- Create performance indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_call_records_created_at ON call_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_status ON call_records(status);
CREATE INDEX IF NOT EXISTS idx_call_records_user_id ON call_records(user_id);
CREATE INDEX IF NOT EXISTS idx_call_records_phone_number ON call_records(phone_number);

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Allow public access to call records" ON call_records;
DROP POLICY IF EXISTS "Users can view own call records" ON call_records;
DROP POLICY IF EXISTS "Users can insert own call records" ON call_records;
DROP POLICY IF EXISTS "Users can update own call records" ON call_records;
DROP POLICY IF EXISTS "Users can delete own call records" ON call_records;

-- Create RLS policies
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

-- Create function to automatically set completed_at timestamp
CREATE OR REPLACE FUNCTION update_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
    NEW.completed_at = now();
  END IF;
  
  IF NEW.status NOT IN ('completed', 'failed') AND OLD.status IN ('completed', 'failed') THEN
    NEW.completed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and recreate it
DROP TRIGGER IF EXISTS trigger_update_completed_at ON call_records;

-- Create trigger for automatic timestamp management
CREATE TRIGGER trigger_update_completed_at
  BEFORE UPDATE ON call_records
  FOR EACH ROW
  EXECUTE FUNCTION update_completed_at();

-- Insert sample data for testing (only if table is empty)
INSERT INTO call_records (
  recipient_name,
  phone_number,
  call_goal,
  additional_context,
  status,
  result_success,
  result_message,
  result_details,
  result_transcript,
  completed_at,
  duration
) 
SELECT 
  'Dr. Smith Medical Office',
  '+1-555-0123',
  'Book appointment',
  'Dental cleaning appointment, preferably next week',
  'completed',
  true,
  'Appointment successfully booked',
  'Appointment scheduled for Tuesday, March 19th at 2:00 PM',
  'Assistant: Hello, I''d like to book a dental cleaning appointment for my client...' || chr(10) ||
  'Receptionist: Certainly! What day works best for you?' || chr(10) ||
  'Assistant: Next week would be ideal...',
  now() - interval '1 hour',
  225
WHERE NOT EXISTS (SELECT 1 FROM call_records LIMIT 1);

INSERT INTO call_records (
  recipient_name,
  phone_number,
  call_goal,
  additional_context,
  status,
  result_success,
  result_message,
  result_details,
  result_transcript,
  completed_at,
  duration
) 
SELECT 
  'Pizza Palace Restaurant',
  '+1-555-0456',
  'Make reservation',
  'Table for 4 people, Friday evening around 7 PM',
  'failed',
  false,
  'Unable to complete reservation',
  'Restaurant is fully booked for Friday evening. Alternative times available.',
  'Assistant: I''d like to make a reservation for 4 people on Friday evening...' || chr(10) ||
  'Host: I''m sorry, we''re completely booked for Friday...',
  now() - interval '2 hours',
  135
WHERE (SELECT COUNT(*) FROM call_records) < 2;

INSERT INTO call_records (
  recipient_name,
  phone_number,
  call_goal,
  additional_context,
  status,
  result_success,
  result_message,
  result_details,
  result_transcript,
  completed_at,
  duration
) 
SELECT 
  'City Library',
  '+1-555-0789',
  'Get information',
  'Ask about weekend hours and book return policy',
  'completed',
  true,
  'Information successfully obtained',
  'Weekend hours: Sat 10AM-6PM, Sun 12PM-5PM. Books can be returned 24/7 via drop box.',
  'Assistant: Could you please tell me about your weekend hours?' || chr(10) ||
  'Librarian: We''re open Saturday 10 to 6 and Sunday noon to 5...',
  now() - interval '30 minutes',
  180
WHERE (SELECT COUNT(*) FROM call_records) < 3;