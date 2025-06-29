import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Twilio-Signature",
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req: Request) => {
  // Always allow OPTIONS requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('TwiML Voice webhook called:', {
      method: req.method,
      url: req.url,
      userAgent: req.headers.get('user-agent'),
      contentType: req.headers.get('content-type'),
      twilioSignature: req.headers.get('x-twilio-signature') ? 'Present' : 'Missing'
    });

    // Get callId from URL parameters
    const url = new URL(req.url);
    const callId = url.searchParams.get('callId');
    
    console.log('Extracted callId:', callId);

    if (!callId) {
      console.error('No callId provided in webhook URL');
      return new Response(generateErrorTwiML('Missing call identifier'), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Handle test requests (these come from our debug panel)
    if (callId?.startsWith('test-')) {
      console.log('Test request to voice webhook:', callId);
      return new Response(generateTestTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Check if this looks like a Twilio request
    const userAgent = req.headers.get('user-agent') || '';
    const isTwilioRequest = userAgent.includes('TwilioProxy') || userAgent.includes('Twilio');
    const hasTwilioSignature = req.headers.get('x-twilio-signature');
    
    console.log('Request analysis:', { isTwilioRequest, hasTwilioSignature: !!hasTwilioSignature });

    // For non-Twilio requests without proper signature, only allow if it's a test
    if (!isTwilioRequest && !hasTwilioSignature && !callId.startsWith('test-')) {
      console.log('Rejecting non-Twilio request without signature');
      return new Response(generateErrorTwiML('Unauthorized'), {
        status: 401,
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Get Twilio webhook data
    let formData;
    try {
      if (req.method === 'POST') {
        formData = await req.formData();
      } else {
        // For GET requests (like our tests), create empty form data
        formData = new FormData();
      }
    } catch (error) {
      console.error('Failed to parse form data:', error);
      return new Response(generateErrorTwiML('Invalid request format'), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;

    console.log('Twilio webhook data:', { callId, callSid, callStatus, from, to });

    // For real Twilio requests, validate required parameters
    if (isTwilioRequest && (!callSid || !from || !to)) {
      console.error('Missing required Twilio parameters');
      return new Response(generateErrorTwiML('Invalid webhook data'), {
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
      return new Response(generateErrorTwiML('Call record not found'), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    console.log('Found call record:', {
      id: callRecord.id,
      recipient_name: callRecord.recipient_name,
      call_goal: callRecord.call_goal
    });

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

    // Update call status in database (only for real calls, not tests)
    if (!callId.startsWith('test-')) {
      const { error: updateError } = await supabase
        .from('call_records')
        .update({ 
          status: 'in-progress',
          // Update additional context with Twilio SID
          additional_context: JSON.stringify({
            ...callDetails,
            twilioSid: callSid || 'test-sid'
          })
        })
        .eq('id', callId);

      if (updateError) {
        console.error('Failed to update call record:', updateError);
      }
    }

    console.log('Generated TwiML for call:', callId);
    console.log('TwiML content:', twiml);

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });

  } catch (error) {
    console.error('TwiML voice webhook error:', error);
    return new Response(generateErrorTwiML('Internal server error'), {
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

function generateErrorTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">I apologize, but there seems to be a technical issue: ${message}. Please try calling back later.</Say>
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