/*
  # Database Schema Setup for AI Call Assistant

  1. New Tables
    - `call_records` - Stores call information and results
  
  2. Security
    - Enable RLS on `call_records` table
    - Add policies for authenticated users to manage their own calls
    - Add public access policy for application functionality
  
  3. Performance
    - Add indexes for common queries
    - Add constraints for data validation
    - Add trigger for automatic timestamp management
*/

-- Create the call_status enum type (only if it doesn't exist)
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

-- Create the call_records table (only if it doesn't exist)
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

-- Add table constraints (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_duration') THEN
        ALTER TABLE call_records ADD CONSTRAINT valid_duration CHECK (duration >= 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_phone_number') THEN
        ALTER TABLE call_records ADD CONSTRAINT valid_phone_number CHECK (length(phone_number) >= 7);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_recipient_name') THEN
        ALTER TABLE call_records ADD CONSTRAINT valid_recipient_name CHECK (length(trim(recipient_name)) > 0);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_call_goal') THEN
        ALTER TABLE call_records ADD CONSTRAINT valid_call_goal CHECK (length(trim(call_goal)) > 0);
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;

-- Create performance indexes (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_call_records_created_at ON call_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_status ON call_records(status);
CREATE INDEX IF NOT EXISTS idx_call_records_user_id ON call_records(user_id);
CREATE INDEX IF NOT EXISTS idx_call_records_phone_number ON call_records(phone_number);

-- Drop existing policies if they exist, then recreate them
DO $$ 
BEGIN
    -- Drop policies if they exist
    DROP POLICY IF EXISTS "Allow public access to call records" ON call_records;
    DROP POLICY IF EXISTS "Users can view own call records" ON call_records;
    DROP POLICY IF EXISTS "Users can insert own call records" ON call_records;
    DROP POLICY IF EXISTS "Users can update own call records" ON call_records;
    DROP POLICY IF EXISTS "Users can delete own call records" ON call_records;
EXCEPTION
    WHEN undefined_object THEN
        -- Policies don't exist, continue
        NULL;
END $$;

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
  -- Set completed_at when status changes to completed or failed
  IF NEW.status IN ('completed', 'failed') AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'failed')) THEN
    NEW.completed_at = now();
  END IF;
  
  -- Clear completed_at if status changes back to active states
  IF NEW.status NOT IN ('completed', 'failed') AND OLD.status IN ('completed', 'failed') THEN
    NEW.completed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp management (drop first if exists)
DROP TRIGGER IF EXISTS trigger_update_completed_at ON call_records;
CREATE TRIGGER trigger_update_completed_at
  BEFORE UPDATE ON call_records
  FOR EACH ROW
  EXECUTE FUNCTION update_completed_at();

-- Insert sample data only if table is empty
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM call_records LIMIT 1) THEN
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
        ) VALUES 
        (
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
        ),
        (
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
        ),
        (
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
        );
    END IF;
END $$;