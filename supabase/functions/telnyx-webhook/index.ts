import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Telnyx-Signature",
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
    console.log('Telnyx webhook called:', {
      method: req.method,
      url: req.url,
      userAgent: req.headers.get('user-agent'),
      contentType: req.headers.get('content-type'),
      telnyxSignature: req.headers.get('x-telnyx-signature') ? 'Present' : 'Missing'
    });

    // Get callId from URL parameters
    const url = new URL(req.url);
    const callId = url.searchParams.get('callId');
    
    console.log('Extracted callId:', callId);

    if (!callId) {
      console.error('No callId provided in webhook URL');
      return new Response('Missing callId', {
        status: 400,
        headers: corsHeaders
      });
    }

    // Handle test requests
    if (callId?.startsWith('test-')) {
      console.log('Test request to Telnyx webhook:', callId);
      return new Response('Test OK - Telnyx webhook is accessible', {
        headers: corsHeaders
      });
    }

    // Get webhook data
    let webhookData;
    try {
      if (req.method === 'POST') {
        webhookData = await req.json();
      } else {
        return new Response('Test OK - Telnyx webhook accessible', {
          headers: corsHeaders
        });
      }
    } catch (error) {
      console.error('Failed to parse webhook data:', error);
      return new Response('Invalid request format', {
        status: 400,
        headers: corsHeaders
      });
    }

    console.log('Telnyx webhook data received:', {
      event_type: webhookData.data?.event_type,
      call_control_id: webhookData.data?.payload?.call_control_id,
      call_status: webhookData.data?.payload?.state
    });

    const eventType = webhookData.data?.event_type;
    const payload = webhookData.data?.payload;

    if (!eventType || !payload) {
      console.error('Invalid webhook payload structure');
      return new Response('Invalid payload', {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get current call record
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

    // Handle different Telnyx events
    let updateData: any = {};

    switch (eventType) {
      case 'call.initiated':
        updateData.status = 'dialing';
        console.log('Call initiated');
        break;

      case 'call.answered':
        updateData.status = 'in-progress';
        console.log('Call answered');
        break;

      case 'call.hangup':
        const duration = payload.hangup_cause === 'normal_clearing' ? 
          (payload.end_time ? Math.floor((new Date(payload.end_time).getTime() - new Date(payload.start_time).getTime()) / 1000) : 0) : 0;
        
        updateData.status = 'completed';
        updateData.duration = duration;
        updateData.completed_at = new Date().toISOString();
        updateData.result_success = payload.hangup_cause === 'normal_clearing' && duration > 15;
        updateData.result_message = updateData.result_success ? 'Call completed successfully' : 'Call ended prematurely';
        updateData.result_details = `Call ended: ${payload.hangup_cause}. Duration: ${duration} seconds.`;
        
        console.log('Call hangup:', { hangup_cause: payload.hangup_cause, duration });
        break;

      case 'call.machine.detection.ended':
        if (payload.result === 'human') {
          updateData.status = 'in-progress';
          console.log('Human detected on call');
        } else {
          updateData.result_details = (currentCall.result_details || '') + ' Call answered by machine/voicemail.';
          console.log('Machine detected on call');
        }
        break;

      case 'call.transcription':
        // Handle real-time transcription
        if (payload.transcript_text) {
          const currentTranscript = currentCall.result_transcript || '';
          const speaker = payload.is_final ? (payload.speaker === 'caller' ? 'Assistente' : 'Pessoa') : 'Pessoa';
          const newTranscript = currentTranscript + `\n${speaker}: ${payload.transcript_text}`;
          
          updateData.result_transcript = newTranscript;
          updateData.status = 'in-progress';
          
          console.log('Transcription received:', {
            speaker: payload.speaker,
            text: payload.transcript_text.substring(0, 50) + '...',
            is_final: payload.is_final
          });
        }
        break;

      case 'call.speak.ended':
        console.log('AI finished speaking');
        break;

      case 'call.gather.ended':
        // Handle speech input completion
        if (payload.digits || payload.speech_result) {
          console.log('Gather completed:', {
            digits: payload.digits,
            speech_result: payload.speech_result?.substring(0, 50) + '...'
          });
        }
        break;

      default:
        console.log('Unhandled event type:', eventType);
        break;
    }

    // Only update if there are actual changes
    const hasChanges = Object.keys(updateData).length > 0;

    if (hasChanges) {
      console.log('Updating call record with changes:', updateData);
      
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
        console.log('Successfully updated call record:', callId);
      }
    } else {
      console.log('No changes detected, skipping database update');
    }

    return new Response('OK', {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Telnyx webhook error:', error);
    return new Response('Error', {
      status: 500,
      headers: corsHeaders
    });
  }
});