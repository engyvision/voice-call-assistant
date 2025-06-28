import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'recent_calls';

    switch (action) {
      case 'recent_calls':
        return await getRecentCalls();
      case 'twilio_logs':
        return await getTwilioLogs();
      case 'webhook_test':
        return await testWebhooks();
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

async function getRecentCalls() {
  // Get recent calls from our database
  const { data: dbCalls, error: dbError } = await supabase
    .from('call_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (dbError) {
    throw new Error(`Database error: ${dbError.message}`);
  }

  // Get recent calls from Twilio API
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return new Response(JSON.stringify({
      database_calls: dbCalls,
      twilio_calls: null,
      error: 'Twilio credentials not configured'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?PageSize=20`;
    
    const response = await fetch(twilioUrl, {
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`
      }
    });

    const twilioData = await response.json();

    return new Response(JSON.stringify({
      database_calls: dbCalls,
      twilio_calls: twilioData.calls || [],
      comparison: compareCalls(dbCalls, twilioData.calls || [])
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (twilioError) {
    return new Response(JSON.stringify({
      database_calls: dbCalls,
      twilio_calls: null,
      twilio_error: twilioError.message
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function getTwilioLogs() {
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials not configured');
  }

  // Get recent alerts/logs from Twilio
  const alertsUrl = `https://monitor.twilio.com/v1/Alerts?PageSize=50`;
  
  const response = await fetch(alertsUrl, {
    headers: {
      'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`
    }
  });

  const alertsData = await response.json();

  return new Response(JSON.stringify({
    alerts: alertsData.alerts || [],
    webhook_urls: {
      voice: `${Deno.env.get('SUPABASE_URL')}/functions/v1/twiml-voice`,
      status: `${Deno.env.get('SUPABASE_URL')}/functions/v1/twiml-status`,
      gather: `${Deno.env.get('SUPABASE_URL')}/functions/v1/twiml-gather`
    }
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function testWebhooks() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const testCallId = 'test-' + Date.now();

  const webhookTests = [
    {
      name: 'TwiML Voice Webhook',
      url: `${supabaseUrl}/functions/v1/twiml-voice?callId=${testCallId}`,
      method: 'POST',
      body: new URLSearchParams({
        CallSid: 'test-call-sid',
        CallStatus: 'in-progress',
        From: '+15551234567',
        To: '+15559876543'
      })
    },
    {
      name: 'TwiML Status Webhook',
      url: `${supabaseUrl}/functions/v1/twiml-status?callId=${testCallId}`,
      method: 'POST',
      body: new URLSearchParams({
        CallSid: 'test-call-sid',
        CallStatus: 'completed',
        CallDuration: '45'
      })
    }
  ];

  const results = [];

  for (const test of webhookTests) {
    try {
      const response = await fetch(test.url, {
        method: test.method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: test.body
      });

      results.push({
        name: test.name,
        url: test.url,
        status: response.status,
        success: response.ok,
        response_text: await response.text()
      });
    } catch (error) {
      results.push({
        name: test.name,
        url: test.url,
        status: 'error',
        success: false,
        error: error.message
      });
    }
  }

  return new Response(JSON.stringify({
    webhook_tests: results,
    test_call_id: testCallId
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function compareCalls(dbCalls: any[], twilioCalls: any[]) {
  const comparison = {
    discrepancies: [],
    matched_calls: 0,
    unmatched_db_calls: 0,
    unmatched_twilio_calls: 0
  };

  // Find calls that exist in database but not in Twilio (or with different status)
  for (const dbCall of dbCalls) {
    const additionalContext = dbCall.additional_context;
    let twilioSid = null;
    
    try {
      const context = JSON.parse(additionalContext || '{}');
      twilioSid = context.twilioSid;
    } catch {
      // If additional_context is not JSON, try to extract SID from string
      const sidMatch = additionalContext?.match(/Twilio SID: ([A-Za-z0-9]+)/);
      twilioSid = sidMatch ? sidMatch[1] : null;
    }

    if (twilioSid) {
      const twilioCall = twilioCalls.find(tc => tc.sid === twilioSid);
      if (twilioCall) {
        comparison.matched_calls++;
        
        // Check for status discrepancies
        const dbStatus = dbCall.status;
        const twilioStatus = twilioCall.status;
        
        if (mapTwilioStatus(twilioStatus) !== dbStatus) {
          comparison.discrepancies.push({
            call_id: dbCall.id,
            twilio_sid: twilioSid,
            db_status: dbStatus,
            twilio_status: twilioStatus,
            phone_number: dbCall.phone_number,
            created_at: dbCall.created_at
          });
        }
      } else {
        comparison.unmatched_db_calls++;
      }
    } else {
      comparison.unmatched_db_calls++;
    }
  }

  return comparison;
}

function mapTwilioStatus(twilioStatus: string): string {
  switch (twilioStatus) {
    case 'queued':
      return 'preparing';
    case 'ringing':
      return 'dialing';
    case 'in-progress':
      return 'in-progress';
    case 'completed':
      return 'completed';
    case 'failed':
    case 'busy':
    case 'no-answer':
    case 'canceled':
      return 'failed';
    default:
      return 'preparing';
  }
}