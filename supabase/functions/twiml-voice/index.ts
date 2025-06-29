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

// Helper function to validate Twilio request
function validateTwilioRequest(req: Request): boolean {
  // In production, you should validate the Twilio signature
  // For now, we'll check for basic Twilio webhook parameters
  const userAgent = req.headers.get('user-agent') || '';
  const contentType = req.headers.get('content-type') || '';
  
  // Twilio sends requests with specific user agent and content type
  return userAgent.includes('TwilioProxy') || 
         contentType.includes('application/x-www-form-urlencoded') ||
         req.headers.get('x-twilio-signature') !== null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get callId from URL parameters
    const url = new URL(req.url);
    const callId = url.searchParams.get('callId');
    
    // Validate request is from Twilio or is a test
    const isValidTwilioRequest = validateTwilioRequest(req);
    const isTestRequest = callId?.startsWith('test-');
    
    if (!isValidTwilioRequest && !isTestRequest) {
      console.log('Unauthorized request to voice webhook');
      return new Response(JSON.stringify({ 
        code: 401, 
        message: 'Missing authorization header' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Handle test requests
    if (isTestRequest) {
      console.log('Test request to voice webhook:', callId);
      return new Response(generateTestTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Also get Twilio webhook data
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;

    console.log('TwiML voice webhook called:', { callId, callSid, callStatus, from, to });

    if (!callId) {
      console.error('No callId provided in webhook URL');
      return new Response(generateErrorTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Get call data from database using our callId
    const { data: callRecord, error } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', callId)
      .single();

    if (error || !callRecord) {
      console.error('Call record not found:', error);
      return new Response(generateErrorTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Parse additional context to get call details
    let callDetails;
    try {
      callDetails = JSON.parse(callRecord.additional_context || '{}');
    } catch {
      callDetails = {
        originalContext: callRecord.additional_context || '',
        recipientName: callRecord.recipient_name,
        callGoal: callRecord.call_goal
      };
    }

    // Generate TwiML based on call goal and context
    const twiml = generateAITwiML(callRecord, callDetails, callId);

    // Update call status in database
    await supabase
      .from('call_records')
      .update({ 
        status: 'in-progress',
        // Update additional context with Twilio SID
        additional_context: JSON.stringify({
          ...callDetails,
          twilioSid: callSid
        })
      })
      .eq('id', callId);

    console.log('Generated TwiML for call:', callId);

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });

  } catch (error) {
    console.error('TwiML voice webhook error:', error);
    return new Response(generateErrorTwiML(), {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });
  }
});

function generateAITwiML(callRecord: any, callDetails: any, callId: string): string {
  const { recipient_name, call_goal } = callRecord;
  const { originalContext } = callDetails;
  
  // Create initial message based on call goal
  const initialMessage = getInitialMessage(call_goal, recipient_name, originalContext);
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${initialMessage}</Say>
  <Gather input="speech" action="${Deno.env.get('SUPABASE_URL')}/functions/v1/twiml-gather?callId=${callId}" method="POST" speechTimeout="3" timeout="10">
    <Say voice="alice">Please let me know if you're available to help with this request.</Say>
  </Gather>
  <Say voice="alice">I didn't hear a response. Thank you for your time, and have a great day!</Say>
  <Hangup/>
</Response>`;
}

function generateTestTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">This is a test response from the TwiML voice webhook. The endpoint is working correctly.</Say>
  <Hangup/>
</Response>`;
}

function getInitialMessage(callGoal: string, recipientName: string, additionalContext: string): string {
  const baseMessage = `Hello, this is an AI assistant calling on behalf of my client.`;
  
  switch (callGoal.toLowerCase()) {
    case 'book appointment':
      return `${baseMessage} I'd like to schedule an appointment. ${additionalContext ? additionalContext : 'Is this a good time to discuss availability?'}`;
    case 'make reservation':
      return `${baseMessage} I'd like to make a reservation. ${additionalContext ? additionalContext : 'Can you help me with this?'}`;
    case 'get information':
      return `${baseMessage} I'm calling to get some information. ${additionalContext ? additionalContext : 'Do you have a moment to help?'}`;
    case 'follow up inquiry':
      return `${baseMessage} I'm following up on a previous inquiry. ${additionalContext ? additionalContext : 'Can we discuss this briefly?'}`;
    case 'schedule consultation':
      return `${baseMessage} I'd like to schedule a consultation. ${additionalContext ? additionalContext : 'What times work best for you?'}`;
    case 'request quote':
      return `${baseMessage} I'm calling to request a quote for services. ${additionalContext ? additionalContext : 'Can you help me with pricing information?'}`;
    default:
      return `${baseMessage} ${additionalContext || 'I have a request to discuss with you. Do you have a moment?'}`;
  }
}

function generateErrorTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">I apologize, but there seems to be a technical issue with this call. Please try calling back later. Thank you.</Say>
  <Hangup/>
</Response>`;
}