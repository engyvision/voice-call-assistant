// Simple test script to check if webhook functions are accessible
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing environment variables');
  process.exit(1);
}

const webhooks = [
  'twiml-voice',
  'twiml-status', 
  'twiml-gather',
  'twilio-initiate',
  'twilio-debug'
];

async function testWebhook(functionName) {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}?callId=test-${Date.now()}`;
  
  try {
    console.log(`Testing ${functionName}...`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    console.log(`${functionName}: HTTP ${response.status}`);
    
    if (response.status === 404) {
      console.log(`❌ ${functionName} - Function not found (not deployed)`);
    } else if (response.status === 401) {
      console.log(`✅ ${functionName} - Function exists but requires auth (expected)`);
    } else {
      console.log(`✅ ${functionName} - Function accessible`);
    }
    
  } catch (error) {
    console.log(`❌ ${functionName} - Error: ${error.message}`);
  }
}

async function testAll() {
  console.log('Testing webhook function accessibility...\n');
  
  for (const webhook of webhooks) {
    await testWebhook(webhook);
  }
  
  console.log('\nIf any functions show "not found", they need to be deployed to Supabase.');
}

testAll();