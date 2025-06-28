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
    // Get callId from URL parameters
    const url = new URL(req.url);
    const callId = url.searchParams.get('callId');
    
    // Get Twilio webhook data
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string;
    const answeredBy = formData.get('AnsweredBy') as string;

    console.log('Call status update:', { callId, callSid, callStatus, callDuration, answeredBy });

    if (!callId) {
      console.error('No callId provided in status webhook URL');
      return new Response('Missing callId', {
        status: 400,
        headers: corsHeaders
      });
    }

    // Update call record based on status
    let updateData: any = { status: mapTwilioStatus(callStatus) };
    
    if (callStatus === 'completed') {
      const duration = parseInt(callDuration) || 0;
      updateData.duration = duration;
      updateData.completed_at = new Date().toISOString();
      
      // Get current call record to check transcript
      const { data: callRecord } = await supabase
        .from('call_records')
        .select('result_transcript, call_goal')
        .eq('id', callId)
        .single();
      
      const wasSuccessful = determineCallSuccess(callRecord?.result_transcript, duration, callRecord?.call_goal);
      
      updateData.result_success = wasSuccessful;
      updateData.result_message = wasSuccessful 
        ? 'Call completed successfully' 
        : duration < 30 
          ? 'Call was too short to complete objective'
          : 'Call completed but objective may not have been achieved';
      
      if (!callRecord?.result_transcript) {
        updateData.result_transcript = `Call completed with duration: ${duration} seconds`;
      }
    }
    
    if (callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer') {
      updateData.result_success = false;
      updateData.completed_at = new Date().toISOString();
      
      // Provide specific error messages
      switch (callStatus) {
        case 'busy':
          updateData.result_message = 'Recipient line was busy';
          updateData.result_details = 'The phone number was busy when we tried to call. Please try again later.';
          break;
        case 'no-answer':
          updateData.result_message = 'No answer received';
          updateData.result_details = 'The call was not answered. You may want to try calling at a different time.';
          break;
        case 'failed':
          updateData.result_message = 'Call failed to connect';
          updateData.result_details = 'The call could not be completed due to a technical issue or invalid number.';
          break;
        default:
          updateData.result_message = `Call ${callStatus}`;
      }
    }

    // Handle answered by machine/voicemail
    if (answeredBy === 'machine_start' || answeredBy === 'machine_end_beep') {
      updateData.result_details = 'Call was answered by voicemail/answering machine';
    }

    const { error: updateError } = await supabase
      .from('call_records')
      .update(updateData)
      .eq('id', callId);

    if (updateError) {
      console.error('Failed to update call record:', updateError);
    } else {
      console.log('Successfully updated call record:', callId, updateData);
    }

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

function determineCallSuccess(transcript: string, duration: number, callGoal: string): boolean {
  // If call was very short, likely unsuccessful
  if (duration < 15) return false;
  
  // If no transcript, base success on duration and call goal
  if (!transcript) {
    // For simple goals, 30+ seconds might be enough
    if (callGoal?.toLowerCase().includes('information') && duration >= 30) return true;
    // For complex goals like appointments, need longer duration
    if (callGoal?.toLowerCase().includes('appointment') && duration >= 60) return true;
    return duration >= 45; // Default threshold
  }
  
  // Analyze transcript for success indicators
  const lowerTranscript = transcript.toLowerCase();
  const successKeywords = ['yes', 'sure', 'available', 'appointment', 'booked', 'scheduled', 'confirmed', 'reserved', 'okay', 'sounds good'];
  const failureKeywords = ['no', 'busy', 'unavailable', 'closed', 'sorry', 'can\'t', 'unable'];
  
  const hasSuccess = successKeywords.some(keyword => lowerTranscript.includes(keyword));
  const hasFailure = failureKeywords.some(keyword => lowerTranscript.includes(keyword));
  
  // Success if we have positive indicators and no strong negative ones, with reasonable duration
  return hasSuccess && !hasFailure && duration > 20;
}