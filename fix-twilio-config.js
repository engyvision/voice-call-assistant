// Script to help identify the correct webhook URLs and provide Twilio configuration

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;

console.log('=== TWILIO WEBHOOK CONFIGURATION FIX ===\n');

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL not found in environment variables');
  console.log('Please check your .env file and ensure VITE_SUPABASE_URL is set correctly.');
  process.exit(1);
}

console.log('✅ Your Supabase URL:', SUPABASE_URL);
console.log('\n=== CORRECT WEBHOOK URLS FOR TWILIO ===');
console.log(`Voice Webhook: ${SUPABASE_URL}/functions/v1/twiml-voice`);
console.log(`Status Callback: ${SUPABASE_URL}/functions/v1/twiml-status`);

console.log('\n=== HOW TO UPDATE TWILIO CONFIGURATION ===');
console.log('1. Go to https://console.twilio.com/');
console.log('2. Navigate to Phone Numbers → Manage → Active numbers');
console.log('3. Click on your phone number');
console.log('4. In the Voice section, update the webhook URL to:');
console.log(`   ${SUPABASE_URL}/functions/v1/twiml-voice`);
console.log('5. Save the configuration');

console.log('\n=== TESTING WEBHOOK ACCESSIBILITY ===');

async function testWebhookAccess() {
  const testUrl = `${SUPABASE_URL}/functions/v1/twiml-voice?callId=test-${Date.now()}`;
  
  try {
    const response = await fetch(testUrl, {
      method: 'GET'
    });
    
    console.log(`Webhook test: HTTP ${response.status}`);
    
    if (response.status === 401) {
      console.log('✅ Webhook is accessible and properly secured (401 is expected for unauthorized requests)');
    } else if (response.status === 404) {
      console.log('❌ Webhook function not found - may not be deployed');
    } else {
      console.log('✅ Webhook is accessible');
    }
    
  } catch (error) {
    console.log('❌ Error testing webhook:', error.message);
  }
}

testWebhookAccess();