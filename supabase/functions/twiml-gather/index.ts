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
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const speechResult = formData.get('SpeechResult') as string;
    const confidence = formData.get('Confidence') as string;

    console.log('Speech gathered:', { callSid, speechResult, confidence });

    // Get call record
    const { data: callRecord } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', callSid)
      .single();

    if (!callRecord) {
      return new Response(generateErrorTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Process speech with AI (OpenAI/Claude)
    const aiResponse = await processWithAI(speechResult, callRecord);
    
    // Generate appropriate TwiML response
    const twiml = generateResponseTwiML(aiResponse, callRecord);

    // Update call record with conversation progress
    await updateCallProgress(callSid, speechResult, aiResponse);

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
      return `Perfect! I'd like to make a reservation. ${additional_context}. What availability do you have?`;
    }
  }
  
  return "Thank you for that information. Let me help you with your request.";
}

function generateResponseTwiML(aiResponse: string, callRecord: any): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${aiResponse}</Say>
  <Gather input="speech" action="/functions/v1/twiml-gather" method="POST" speechTimeout="3" timeout="10">
    <Say voice="alice">Please let me know how I can help.</Say>
  </Gather>
  <Say voice="alice">Thank you for your time. Have a great day!</Say>
  <Hangup/>
</Response>`;
}

async function updateCallProgress(callSid: string, userSpeech: string, aiResponse: string) {
  // Update the call record with conversation progress
  const { data: currentRecord } = await supabase
    .from('call_records')
    .select('result_transcript')
    .eq('id', callSid)
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
    .eq('id', callSid);
}

function generateErrorTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">I apologize, but there seems to be a technical issue. Please try calling back later.</Say>
  <Hangup/>
</Response>`;
}