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
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string;

    console.log('Call status update:', { callSid, callStatus, callDuration });

    // Update call record based on status
    let updateData: any = { status: mapTwilioStatus(callStatus) };
    
    if (callStatus === 'completed') {
      updateData.duration = parseInt(callDuration) || 0;
      updateData.completed_at = new Date().toISOString();
      
      // Determine if call was successful based on duration and transcript
      const { data: callRecord } = await supabase
        .from('call_records')
        .select('result_transcript')
        .eq('id', callSid)
        .single();
      
      const wasSuccessful = determineCallSuccess(callRecord?.result_transcript, parseInt(callDuration));
      
      updateData.result_success = wasSuccessful;
      updateData.result_message = wasSuccessful 
        ? 'Call completed successfully' 
        : 'Call completed but objective may not have been achieved';
    }
    
    if (callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer') {
      updateData.result_success = false;
      updateData.result_message = `Call ${callStatus}`;
      updateData.completed_at = new Date().toISOString();
    }

    await supabase
      .from('call_records')
      .update(updateData)
      .eq('id', callSid);

    return new Response('OK', {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Status webhook error:', error);
    return new Response('Error', {
      status: 500,
      headers: corsHeaders
    });
  }
});

function mapTwilioStatus(twilioStatus: string): string {
  switch (twilioStatus) {
    case 'queued':
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

function determineCallSuccess(transcript: string, duration: number): boolean {
  if (!transcript || duration < 30) return false;
  
  // Simple heuristics - replace with more sophisticated analysis
  const successKeywords = ['appointment', 'booked', 'scheduled', 'confirmed', 'reserved', 'yes', 'available'];
  const failureKeywords = ['no', 'busy', 'unavailable', 'closed', 'sorry'];
  
  const lowerTranscript = transcript.toLowerCase();
  const hasSuccess = successKeywords.some(keyword => lowerTranscript.includes(keyword));
  const hasFailure = failureKeywords.some(keyword => lowerTranscript.includes(keyword));
  
  return hasSuccess && !hasFailure && duration > 60;
}