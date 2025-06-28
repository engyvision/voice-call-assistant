import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    VITE_SUPABASE_URL: !!supabaseUrl,
    VITE_SUPABASE_ANON_KEY: !!supabaseAnonKey
  });
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client with better error handling and connection management
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'ai-call-assistant'
    }
  }
});

// Add connection health monitoring
let isConnected = false;

supabase.channel('connection-status')
  .on('system', {}, (payload) => {
    console.log('Supabase connection status:', payload);
    isConnected = payload.status === 'SUBSCRIBED';
  })
  .subscribe();

// Export connection status checker
export const getConnectionStatus = () => isConnected;