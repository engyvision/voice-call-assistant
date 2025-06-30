// Telnyx Configuration Verification Script
// Run this with: node verify-telnyx-config.js

import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 TELNYX CONFIGURATION VERIFICATION\n');

// Check environment variables
const requiredVars = {
  'VITE_TELNYX_API_KEY': process.env.VITE_TELNYX_API_KEY,
  'VITE_TELNYX_CONNECTION_ID': process.env.VITE_TELNYX_CONNECTION_ID,
  'VITE_TELNYX_PHONE_NUMBER': process.env.VITE_TELNYX_PHONE_NUMBER,
  'VITE_OPENAI_API_KEY': process.env.VITE_OPENAI_API_KEY,
  'VITE_SUPABASE_URL': process.env.VITE_SUPABASE_URL,
  'VITE_SUPABASE_ANON_KEY': process.env.VITE_SUPABASE_ANON_KEY
};

console.log('📋 Environment Variables Check:');
let allVarsSet = true;
for (const [key, value] of Object.entries(requiredVars)) {
  const status = value ? '✅' : '❌';
  const displayValue = value ? `${value.substring(0, 8)}...` : 'NOT SET';
  console.log(`${status} ${key}: ${displayValue}`);
  if (!value) allVarsSet = false;
}

if (!allVarsSet) {
  console.log('\n❌ Missing environment variables. Please check your .env file.\n');
  process.exit(1);
}

console.log('\n🧪 API Connectivity Tests:\n');

// Test Telnyx API
async function testTelnyxAPI() {
  try {
    console.log('Testing Telnyx API...');
    const response = await fetch('https://api.telnyx.com/v2/phone_numbers', {
      headers: {
        'Authorization': `Bearer ${process.env.VITE_TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const phoneNumbers = data.data || [];
      const hasConfiguredNumber = phoneNumbers.some(num => 
        num.phone_number === process.env.VITE_TELNYX_PHONE_NUMBER
      );
      
      console.log(`✅ Telnyx API: Connected`);
      console.log(`   📞 Found ${phoneNumbers.length} phone numbers`);
      console.log(`   🎯 Configured number (${process.env.VITE_TELNYX_PHONE_NUMBER}): ${hasConfiguredNumber ? 'Found' : 'NOT FOUND'}`);
      
      if (!hasConfiguredNumber) {
        console.log('   ⚠️  Your configured phone number was not found in your Telnyx account');
      }
    } else {
      console.log(`❌ Telnyx API: HTTP ${response.status}`);
      const error = await response.text();
      console.log(`   Error: ${error}`);
    }
  } catch (error) {
    console.log(`❌ Telnyx API: ${error.message}`);
  }
}

// Test OpenAI API
async function testOpenAIAPI() {
  try {
    console.log('Testing OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.VITE_OPENAI_API_KEY}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const hasGPT4o = data.data.some(model => model.id.includes('gpt-4o'));
      console.log(`✅ OpenAI API: Connected`);
      console.log(`   🤖 Found ${data.data.length} models`);
      console.log(`   🎯 GPT-4o available: ${hasGPT4o ? 'Yes' : 'No'}`);
      
      if (!hasGPT4o) {
        console.log('   ⚠️  GPT-4o not available. You may need to upgrade your OpenAI plan.');
      }
    } else {
      console.log(`❌ OpenAI API: HTTP ${response.status}`);
      if (response.status === 401) {
        console.log('   Error: Invalid API key');
      }
    }
  } catch (error) {
    console.log(`❌ OpenAI API: ${error.message}`);
  }
}

// Test Supabase connection
async function testSupabaseAPI() {
  try {
    console.log('Testing Supabase API...');
    const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/call_records?select=count`, {
      headers: {
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
        'apikey': process.env.VITE_SUPABASE_ANON_KEY
      }
    });

    if (response.ok) {
      console.log(`✅ Supabase API: Connected`);
      console.log(`   🗄️  Database accessible`);
    } else {
      console.log(`❌ Supabase API: HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Supabase API: ${error.message}`);
  }
}

// Test webhook functions
async function testWebhookFunctions() {
  try {
    console.log('Testing Webhook Functions...');
    const testCallId = `test-${Date.now()}`;
    
    const webhooks = [
      'telnyx-initiate',
      'telnyx-webhook'
    ];

    for (const webhook of webhooks) {
      try {
        const response = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/${webhook}?callId=${testCallId}`, {
          method: 'GET'
        });
        
        const status = response.status === 404 ? '❌ Not deployed' : 
                     response.status === 401 ? '⚠️  Needs auth (normal)' : 
                     '✅ Accessible';
        
        console.log(`   ${status} ${webhook}`);
      } catch (error) {
        console.log(`   ❌ Error ${webhook}: ${error.message}`);
      }
    }
  } catch (error) {
    console.log(`❌ Webhook test failed: ${error.message}`);
  }
}

// Run all tests
async function runAllTests() {
  await testTelnyxAPI();
  console.log('');
  await testOpenAIAPI();
  console.log('');
  await testSupabaseAPI();
  console.log('');
  await testWebhookFunctions();
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. If all tests pass: Try making a test call in your app');
  console.log('2. If Telnyx fails: Check your API key and phone number configuration');
  console.log('3. If OpenAI fails: Verify your API key and account status');
  console.log('4. If webhooks fail: Deploy Edge Functions to Supabase');
  console.log('5. Use the Diagnostics tool in your app for more detailed testing');
  
  console.log('\n📚 CONFIGURATION GUIDE:');
  console.log('- Telnyx Dashboard: https://portal.telnyx.com');
  console.log('- OpenAI Dashboard: https://platform.openai.com');
  console.log('- Supabase Dashboard: https://supabase.com/dashboard');
  console.log('- Full setup guide: See TELNYX_SETUP_GUIDE.md');
}

runAllTests().catch(console.error);