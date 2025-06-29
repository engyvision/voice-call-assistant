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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('TwiML Gather webhook called:', {
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
      console.error('No callId provided in gather webhook URL');
      return new Response(generateErrorTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Handle test requests (these come from our debug panel)
    if (callId?.startsWith('test-')) {
      console.log('Test request to gather webhook:', callId);
      return new Response(generateTestTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Check if this looks like a Twilio request
    const userAgent = req.headers.get('user-agent') || '';
    const isTwilioRequest = userAgent.includes('TwilioProxy') || userAgent.includes('Twilio');
    const hasTwilioSignature = req.headers.get('x-twilio-signature');
    
    console.log('Request analysis:', { isTwilioRequest, hasTwilioSignature: !!hasTwilioSignature });

    // Accept requests from Twilio (with signature) or allow all for now to debug
    if (!isTwilioRequest && !hasTwilioSignature) {
      console.log('Non-Twilio request without signature - allowing for debugging');
      // For debugging, we'll allow these requests but log them
    }

    // Get Twilio webhook data
    let formData;
    try {
      if (req.method === 'POST') {
        formData = await req.formData();
      } else {
        // For GET requests (like our tests), return test TwiML
        return new Response(generateTestTwiML(), {
          headers: { 'Content-Type': 'text/xml', ...corsHeaders }
        });
      }
    } catch (error) {
      console.error('Failed to parse form data:', error);
      return new Response(generateErrorTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }
    
    const callSid = formData.get('CallSid') as string;
    const speechResult = formData.get('SpeechResult') as string;
    const confidence = formData.get('Confidence') as string;

    console.log('Speech gathered:', { callId, callSid, speechResult, confidence });

    // Get call record
    const { data: callRecord } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', callId)
      .single();

    if (!callRecord) {
      return new Response(generateErrorTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Process speech with AI (simple rule-based for now)
    const aiResponse = await processWithAI(speechResult, callRecord);
    
    // Generate appropriate TwiML response
    const twiml = generateResponseTwiML(aiResponse, callId);

    // Update call record with conversation progress (only for real calls)
    if (!callId.startsWith('test-')) {
      await updateCallProgress(callId, speechResult, aiResponse);
    }

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });

  } catch (error) {
    console.error('TwiML gather error:', error);
    return new Response(generateErrorTwiML(), {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });
  }
});

async function processWithAI(userSpeech: string, callRecord: any): Promise<string> {
  // This is where you'd integrate with OpenAI or Claude
  // For now, return a simple response based on call goal
  
  const { call_goal, recipient_name, additional_context } = callRecord;
  
  // Simple rule-based responses (replace with actual AI integration)
  if (call_goal.includes('appointment')) {
    if (userSpeech.toLowerCase().includes('yes') || userSpeech.toLowerCase().includes('available')) {
      return "Great! I'd like to schedule an appointment for next week. What days and times work best for you?";
    } else if (userSpeech.toLowerCase().includes('no') || userSpeech.toLowerCase().includes('busy')) {
      return "I understand you're busy. When would be a better time to call back to schedule an appointment?";
    }
  }
  
  if (call_goal.includes('reservation')) {
    if (userSpeech.toLowerCase().includes('yes')) {
      return `Perfect! I'd like to make a reservation. What availability do you have?`;
    }
  }
  
  if (call_goal.includes('information')) {
    return "Thank you. Could you please provide me with the information I requested?";
  }
  
  return "Thank you for that information. Let me help you with your request.";
}

function generateResponseTwiML(aiResponse: string, callId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${aiResponse}</Say>
  <Gather input="speech" action="${Deno.env.get('SUPABASE_URL')}/functions/v1/twiml-gather?callId=${callId}" method="POST" speechTimeout="3" timeout="10">
    <Say voice="alice">Please let me know how I can help.</Say>
  </Gather>
  <Say voice="alice">Thank you for your time. Have a great day!</Say>
  <Hangup/>
</Response>`;
}

function generateTestTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">This is a test response from the TwiML gather webhook. The endpoint is working correctly.</Say>
  <Hangup/>
</Response>`;
}

async function updateCallProgress(callId: string, userSpeech: string, aiResponse: string) {
  // Update the call record with conversation progress
  const { data: currentRecord } = await supabase
    .from('call_records')
    .select('result_transcript')
    .eq('id', callId)
    .single();

  const currentTranscript = currentRecord?.result_transcript || '';
  const newTranscript = currentTranscript + 
    `\nUser: ${userSpeech}\nAssistant: ${aiResponse}`;

  await supabase
    .from('call_records')
    .update({ 
      result_transcript: newTranscript,
      status: 'in-progress'
    })
    .eq('id', callId);
}

function generateErrorTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">I apologize, but there seems to be a technical issue. Please try calling back later.</Say>
  <Hangup/>
</Response>`;
}