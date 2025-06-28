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

interface CallData {
  callId: string;
  recipientName: string;
  callGoal: string;
  additionalContext: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;

    console.log('TwiML webhook called:', { callSid, callStatus, from, to });

    // Get call data from database using CallSid
    const { data: callRecord, error } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', callSid)
      .single();

    if (error || !callRecord) {
      console.error('Call record not found:', error);
      return new Response(generateErrorTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Generate TwiML based on call goal and context
    const twiml = generateAITwiML(callRecord);

    // Update call status in database
    await supabase
      .from('call_records')
      .update({ status: 'in-progress' })
      .eq('id', callSid);

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });

  } catch (error) {
    console.error('TwiML webhook error:', error);
    return new Response(generateErrorTwiML(), {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });
  }
});

function generateAITwiML(callRecord: any): string {
  const { recipient_name, call_goal, additional_context } = callRecord;
  
  // Create AI prompt based on call goal
  const aiPrompt = createAIPrompt(call_goal, recipient_name, additional_context);
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    Hello, this is an AI assistant calling on behalf of my client. 
    ${getInitialMessage(call_goal, recipient_name)}
  </Say>
  <Gather input="speech" action="/functions/v1/twiml-gather" method="POST" speechTimeout="3" timeout="10">
    <Say voice="alice">How can I help you today?</Say>
  </Gather>
  <Say voice="alice">I didn't hear a response. Let me try again.</Say>
  <Redirect>/functions/v1/twiml-voice</Redirect>
</Response>`;
}

function getInitialMessage(callGoal: string, recipientName: string): string {
  switch (callGoal.toLowerCase()) {
    case 'book appointment':
      return `I'd like to schedule an appointment for my client. Is this ${recipientName}?`;
    case 'make reservation':
      return `I'd like to make a reservation. Am I speaking with ${recipientName}?`;
    case 'get information':
      return `I'm calling to get some information. Is this ${recipientName}?`;
    default:
      return `I'm calling regarding a request for my client. Is this ${recipientName}?`;
  }
}

function createAIPrompt(callGoal: string, recipientName: string, context: string): string {
  return `You are a professional AI assistant making a phone call. 
Goal: ${callGoal}
Recipient: ${recipientName}
Context: ${context}
Be polite, professional, and focused on achieving the goal.`;
}

function generateErrorTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">I apologize, but there seems to be a technical issue. Please try calling back later.</Say>
  <Hangup/>
</Response>`;
}