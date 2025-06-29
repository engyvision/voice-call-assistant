/*
  # Create call records table with enhanced features

  1. New Tables
    - `call_records`
      - `id` (uuid, primary key)
      - `recipient_name` (text, required)
      - `phone_number` (text, required, min 7 chars)
      - `call_goal` (text, required)
      - `additional_context` (text, optional)
      - `status` (call_status enum, default 'preparing')
      - `result_success` (boolean, nullable)
      - `result_message` (text, nullable)
      - `result_details` (text, nullable)
      - `result_transcript` (text, nullable)
      - `created_at` (timestamptz, default now)
      - `completed_at` (timestamptz, nullable)
      - `duration` (integer, default 0, min 0)
      - `user_id` (uuid, foreign key to auth.users)

  2. Security
    - Enable RLS on `call_records` table
    - Add policies for authenticated users to manage their own records
    - Add public access policy for application functionality

  3. Performance
    - Add indexes on frequently queried columns
    - Add trigger to automatically set completed_at timestamp

  4. Data Integrity
    - Add constraints for phone number, names, and duration validation
    - Add trigger function for automatic timestamp management
*/

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

-- Insert some sample data for testing (using proper UUID generation)
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
  'Assistente: Olá, gostaria de agendar uma consulta de limpeza dental para meu cliente.' || chr(10) ||
  'Recepcionista: Claro! Que dia funciona melhor para vocês?' || chr(10) ||
  'Assistente: A próxima semana seria ideal.' || chr(10) ||
  'Recepcionista: Temos disponibilidade na terça-feira, 19 de março, às 14h.' || chr(10) ||
  'Assistente: Perfeito! Vamos confirmar esse horário.' || chr(10) ||
  'Recepcionista: Agendado! Qual o nome do paciente?' || chr(10) ||
  'Assistente: João Silva. Obrigado pela atenção!',
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
  'Assistente: Gostaria de fazer uma reserva para 4 pessoas na sexta à noite, por volta das 19h.' || chr(10) ||
  'Atendente: Sinto muito, estamos completamente lotados na sexta à noite.' || chr(10) ||
  'Assistente: Vocês têm disponibilidade em outros horários?' || chr(10) ||
  'Atendente: Temos sábado às 18h ou domingo às 19h30.' || chr(10) ||
  'Assistente: Vou verificar com meu cliente e retorno. Obrigado!',
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
  'Assistente: Poderia me informar sobre os horários de funcionamento no fim de semana?' || chr(10) ||
  'Bibliotecária: Funcionamos sábado das 10h às 18h e domingo do meio-dia às 17h.' || chr(10) ||
  'Assistente: E sobre a devolução de livros?' || chr(10) ||
  'Bibliotecária: Temos uma caixa de devolução 24 horas na entrada principal.' || chr(10) ||
  'Assistente: Perfeito! Muito obrigado pelas informações.',
  now() - interval '30 minutes',
  180
),
(
  'Tech Support Helpdesk',
  '+1-555-0321',
  'Follow up inquiry',
  'Following up on ticket #12345 about internet connectivity issues',
  'in-progress',
  null,
  null,
  null,
  'Assistente: Olá, estou ligando para acompanhar o ticket 12345 sobre problemas de conectividade.' || chr(10) ||
  'Técnico: Deixe-me verificar o status do seu ticket...',
  null,
  45
),
(
  'Local Gym Membership',
  '+1-555-0654',
  'Request quote',
  'Interested in monthly membership rates and available classes',
  'preparing',
  null,
  null,
  null,
  null,
  null,
  0
)
ON CONFLICT (id) DO NOTHING;