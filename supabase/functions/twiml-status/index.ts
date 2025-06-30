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
    console.log('TwiML Status webhook called:', {
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
      console.error('No callId provided in status webhook URL');
      return new Response('Missing callId', {
        status: 400,
        headers: corsHeaders
      });
    }

    // Handle test requests (these come from our debug panel)
    if (callId?.startsWith('test-')) {
      console.log('Test request to status webhook:', callId);
      return new Response('Test OK - Status webhook is accessible', {
        headers: corsHeaders
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
        return new Response('Test OK - Status webhook accessible', {
          headers: corsHeaders
        });
      }
    } catch (error) {
      console.error('Failed to parse form data:', error);
      return new Response('Invalid request format', {
        status: 400,
        headers: corsHeaders
      });
    }

    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string;
    const answeredBy = formData.get('AnsweredBy') as string;
    const hangupCause = formData.get('HangupCause') as string;

    console.log('Call status update received:', { 
      callId, 
      callSid, 
      callStatus, 
      callDuration, 
      answeredBy, 
      hangupCause 
    });

    // Get current call record to check existing status
    const { data: currentCall, error: fetchError } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', callId)
      .single();

    if (fetchError || !currentCall) {
      console.error('Call record not found:', fetchError);
      return new Response('Call record not found', {
        status: 404,
        headers: corsHeaders
      });
    }

    console.log('Current call status in DB:', currentCall.status);

    // Prepare update data
    let updateData: any = { 
      status: mapTwilioStatus(callStatus)
    };
    
    // Handle call completion
    if (callStatus === 'completed') {
      const duration = parseInt(callDuration) || 0;
      updateData.duration = duration;
      updateData.completed_at = new Date().toISOString();
      updateData.status = 'completed';
      
      console.log('Call completed with duration:', duration, 'seconds');
      
      const wasSuccessful = determineCallSuccess(
        currentCall.result_transcript, 
        duration, 
        currentCall.call_goal,
        hangupCause
      );
      
      updateData.result_success = wasSuccessful;
      updateData.result_message = wasSuccessful 
        ? 'Call completed successfully' 
        : duration < 30 
          ? 'Call was too short to complete objective'
          : 'Call completed but objective may not have been achieved';
      
      // Add hangup cause to details if available
      if (hangupCause) {
        updateData.result_details = `Call ended: ${hangupCause}. Duration: ${duration} seconds.`;
      } else {
        updateData.result_details = `Call completed successfully. Duration: ${duration} seconds.`;
      }
      
      if (!currentCall.result_transcript) {
        updateData.result_transcript = `Call completed with duration: ${duration} seconds`;
      }

      console.log('Marking call as completed:', { callId, duration, wasSuccessful });
    }
    
    // Handle call failures
    if (['failed', 'busy', 'no-answer', 'canceled'].includes(callStatus)) {
      updateData.result_success = false;
      updateData.completed_at = new Date().toISOString();
      updateData.status = 'failed';
      updateData.duration = parseInt(callDuration) || 0; // Set duration even for failed calls
      
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
        case 'canceled':
          updateData.result_message = 'Call was canceled';
          updateData.result_details = 'The call was canceled before completion.';
          break;
        case 'failed':
          updateData.result_message = 'Call failed to connect';
          updateData.result_details = hangupCause 
            ? `Call failed: ${hangupCause}` 
            : 'The call could not be completed due to a technical issue or invalid number.';
          break;
        default:
          updateData.result_message = `Call ${callStatus}`;
      }

      console.log('Marking call as failed:', { callId, callStatus, hangupCause, duration: updateData.duration });
    }

    // Handle answered by machine/voicemail
    if (answeredBy === 'machine_start' || answeredBy === 'machine_end_beep') {
      updateData.result_details = (updateData.result_details || '') + 
        ' Call was answered by voicemail/answering machine.';
    }

    // Only update if there are actual changes
    const hasChanges = Object.keys(updateData).some(key => 
      updateData[key] !== currentCall[key]
    );

    if (hasChanges) {
      console.log('Updating call record with changes:', updateData);
      
      // Perform the database update
      const { error: updateError } = await supabase
        .from('call_records')
        .update(updateData)
        .eq('id', callId);

      if (updateError) {
        console.error('Failed to update call record:', updateError);
        return new Response('Database update failed', {
          status: 500,
          headers: corsHeaders
        });
      } else {
        console.log('Successfully updated call record:', callId, 'with duration:', updateData.duration);
      }
    } else {
      console.log('No changes detected, skipping database update');
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
      console.log('Unknown Twilio status:', twilioStatus);
      return 'preparing';
  }
}

function determineCallSuccess(
  transcript: string, 
  duration: number, 
  callGoal: string, 
  hangupCause?: string
): boolean {
  // If call was very short, likely unsuccessful
  if (duration < 15) return false;
  
  // If hangup cause indicates failure
  if (hangupCause && ['busy', 'no-answer', 'failed'].includes(hangupCause)) {
    return false;
  }
  
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
  const successKeywords = [
    'yes', 'sure', 'available', 'appointment', 'booked', 'scheduled', 
    'confirmed', 'reserved', 'okay', 'sounds good', 'perfect', 'great',
    'sim', 'claro', 'disponível', 'agendado', 'confirmado', 'reservado'
  ];
  const failureKeywords = [
    'no', 'busy', 'unavailable', 'closed', 'sorry', 'can\'t', 'unable',
    'não', 'ocupado', 'indisponível', 'fechado', 'desculpe'
  ];
  
  const hasSuccess = successKeywords.some(keyword => lowerTranscript.includes(keyword));
  const hasFailure = failureKeywords.some(keyword => lowerTranscript.includes(keyword));
  
  // Success if we have positive indicators and no strong negative ones, with reasonable duration
  return hasSuccess && !hasFailure && duration > 20;
}