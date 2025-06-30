import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Telnyx credentials from environment
const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY');
const TELNYX_CONNECTION_ID = Deno.env.get('TELNYX_CONNECTION_ID');
const TELNYX_PHONE_NUMBER = Deno.env.get('TELNYX_PHONE_NUMBER');

// Helper function to get country from phone number
function getCountryFromPhoneNumber(phoneNumber: string): string {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Common country codes
  const countryCodes: { [key: string]: string } = {
    '1': 'US/Canada',
    '44': 'United Kingdom',
    '33': 'France',
    '49': 'Germany',
    '39': 'Italy',
    '34': 'Spain',
    '351': 'Portugal',
    '31': 'Netherlands',
    '32': 'Belgium',
    '41': 'Switzerland',
    '43': 'Austria',
    '45': 'Denmark',
    '46': 'Sweden',
    '47': 'Norway',
    '48': 'Poland',
    '55': 'Brazil',
    '52': 'Mexico',
    '54': 'Argentina',
    '61': 'Australia',
    '64': 'New Zealand',
    '81': 'Japan',
    '82': 'South Korea',
    '86': 'China',
    '91': 'India',
  };

  // Check for longer country codes first
  for (let i = 3; i >= 1; i--) {
    const code = cleanNumber.substring(0, i);
    if (countryCodes[code]) {
      return countryCodes[code];
    }
  }

  return 'Unknown';
}

// Helper function to parse Telnyx error response
function parseTelnyxError(errorText: string): { message: string; isPermissionError: boolean } {
  try {
    const errorData = JSON.parse(errorText);
    const message = errorData.errors?.[0]?.detail || errorData.message || errorText;
    const isPermissionError = message.includes('not authorized') || 
                             message.includes('permissions') ||
                             message.includes('forbidden');
    
    return { message, isPermissionError };
  } catch {
    const isPermissionError = errorText.includes('not authorized') || 
                             errorText.includes('permissions') ||
                             errorText.includes('forbidden');
    
    return { message: errorText, isPermissionError };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Check if required environment variables are set
    if (!TELNYX_API_KEY || !TELNYX_CONNECTION_ID || !TELNYX_PHONE_NUMBER) {
      console.error('Missing Telnyx environment variables:', {
        TELNYX_API_KEY: !!TELNYX_API_KEY,
        TELNYX_CONNECTION_ID: !!TELNYX_CONNECTION_ID,
        TELNYX_PHONE_NUMBER: !!TELNYX_PHONE_NUMBER
      });
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Telnyx credentials not configured. Please set TELNYX_API_KEY, TELNYX_CONNECTION_ID, and TELNYX_PHONE_NUMBER in your Supabase Edge Function environment variables.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { callId, phoneNumber, recipientName, callGoal, additionalContext } = await req.json();

    console.log('Initiating Telnyx call for:', { callId, phoneNumber, recipientName });

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get country information for better error messages
    const targetCountry = getCountryFromPhoneNumber(phoneNumber);
    console.log('Target country detected:', targetCountry);

    // Create Telnyx call with proper webhook URLs
    const telnyxUrl = 'https://api.telnyx.com/v2/calls';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    
    const callPayload = {
      connection_id: TELNYX_CONNECTION_ID,
      to: phoneNumber,
      from: TELNYX_PHONE_NUMBER,
      webhook_url: `${supabaseUrl}/functions/v1/telnyx-webhook?callId=${callId}`,
      webhook_url_method: 'POST',
      timeout_secs: 30,
      // AI Assistant configuration
      ai_config: {
        transcription_model: 'distil-whisper/distil-large-v2',
        language_model: 'openai/gpt-4o',
        tts_engine: 'aws.polly',
        tts_voice: 'Joanna-Neural',
        system_prompt: `You are a professional AI assistant making a phone call.

CALL OBJECTIVE: ${callGoal}
RECIPIENT: ${recipientName}
CONTEXT: ${additionalContext || 'No additional context provided'}

INSTRUCTIONS:
1. Be polite, professional, and natural
2. Speak clearly in English
3. Keep responses concise (2-3 sentences max)
4. Be specific about the call objective
5. Ask clear questions when you need information
6. Confirm important information
7. Always thank the person for their time
8. End the call when the objective is achieved or if the person wants to end

CONVERSATION RULES:
- If you don't understand something, politely ask them to repeat
- If the person is busy, offer to call back at a better time
- If you achieve the objective, confirm details and thank them
- If you can't achieve the objective, thank them and end politely
- Be honest if you don't know specific information

Remember: You represent your client professionally and efficiently.`,
        initial_message: `Hello, this is an AI assistant calling on behalf of my client regarding ${callGoal.toLowerCase()}. Is this a good time to speak briefly?`
      }
    };
    
    console.log('Making Telnyx API request to:', telnyxUrl);
    console.log('Webhook URL:', `${supabaseUrl}/functions/v1/telnyx-webhook?callId=${callId}`);
    
    const response = await fetch(telnyxUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callPayload)
    });

    console.log('Telnyx API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Telnyx API error response:', errorText);
      
      const { message, isPermissionError } = parseTelnyxError(errorText);
      
      let errorMessage = `Telnyx API Error: ${message}`;
      
      // Provide specific guidance for permission errors
      if (isPermissionError) {
        errorMessage = `Call permissions not enabled for ${targetCountry}. 

To fix this issue:
1. Log into your Telnyx Portal at https://portal.telnyx.com
2. Navigate to Numbers → My Numbers
3. Select your phone number (${TELNYX_PHONE_NUMBER})
4. Enable outbound calling permissions for ${targetCountry}
5. Wait a few minutes for the changes to take effect
6. Try making the call again

Original error: ${message}`;
      }
      
      // Update call record with error status
      await supabase
        .from('call_records')
        .update({ 
          status: 'failed',
          result_success: false,
          result_message: isPermissionError ? 'Geographic permissions required' : 'Call initiation failed',
          result_details: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('id', callId);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage,
        errorType: isPermissionError ? 'geo_permission' : 'telnyx_api',
        targetCountry: targetCountry
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const callData = await response.json();
    console.log('Telnyx call created successfully:', callData.data.call_control_id);
    
    // Update call record with Telnyx call control ID and status
    const { error: updateError } = await supabase
      .from('call_records')
      .update({ 
        status: 'dialing',
        // Store Telnyx call control ID and call details for webhook access
        additional_context: JSON.stringify({
          originalContext: additionalContext || '',
          telnyxCallControlId: callData.data.call_control_id,
          recipientName: recipientName,
          callGoal: callGoal
        })
      })
      .eq('id', callId);

    if (updateError) {
      console.error('Failed to update call record:', updateError);
      // Don't fail the entire request if database update fails
    }

    // Set up a server-side timeout to mark call as failed if no status updates come
    setTimeout(async () => {
      try {
        const { data: currentCall } = await supabase
          .from('call_records')
          .select('status')
          .eq('id', callId)
          .single();
        
        // If call is still in dialing state after 2 minutes, mark as failed
        if (currentCall && currentCall.status === 'dialing') {
          console.log('Server-side call timeout - marking as failed:', callId);
          await supabase
            .from('call_records')
            .update({ 
              status: 'failed',
              result_success: false,
              result_message: 'Call timeout',
              result_details: 'The call did not connect within the expected timeframe. The number may be invalid, unreachable, or not answering.',
              completed_at: new Date().toISOString()
            })
            .eq('id', callId);
        }
      } catch (error) {
        console.error('Error in server-side timeout handler:', error);
      }
    }, 120000); // 2 minutes timeout

    return new Response(JSON.stringify({ 
      success: true, 
      telnyxCallId: callData.data.call_control_id,
      callId: callId
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Call initiation error:', error);
    
    // Update call record with error status
    try {
      const { callId } = await req.json();
      if (callId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabase
          .from('call_records')
          .update({ 
            status: 'failed',
            result_success: false,
            result_message: 'Internal server error',
            result_details: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', callId);
      }
    } catch (dbError) {
      console.error('Failed to update call record with error:', dbError);
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Internal error: ${error.message}`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});