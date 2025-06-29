import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Twilio credentials from environment
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

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

// Helper function to parse Twilio error response
function parseTwilioError(errorText: string): { message: string; isGeoPermissionError: boolean } {
  try {
    const errorData = JSON.parse(errorText);
    const message = errorData.message || errorText;
    const isGeoPermissionError = message.includes('not authorized to call') || 
                                message.includes('geo-permissions') ||
                                message.includes('international permissions');
    
    return { message, isGeoPermissionError };
  } catch {
    const isGeoPermissionError = errorText.includes('not authorized to call') || 
                                errorText.includes('geo-permissions') ||
                                errorText.includes('international permissions');
    
    return { message: errorText, isGeoPermissionError };
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
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error('Missing Twilio environment variables:', {
        TWILIO_ACCOUNT_SID: !!TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: !!TWILIO_AUTH_TOKEN,
        TWILIO_PHONE_NUMBER: !!TWILIO_PHONE_NUMBER
      });
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your Supabase Edge Function environment variables.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { callId, phoneNumber, recipientName, callGoal, additionalContext } = await req.json();

    console.log('Initiating call for:', { callId, phoneNumber, recipientName });

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get country information for better error messages
    const targetCountry = getCountryFromPhoneNumber(phoneNumber);
    console.log('Target country detected:', targetCountry);

    // Create Twilio call with proper webhook URLs
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    
    const formData = new URLSearchParams();
    formData.append('To', phoneNumber);
    formData.append('From', TWILIO_PHONE_NUMBER);
    // Use the call ID as a parameter to identify the call in webhooks
    formData.append('Url', `${supabaseUrl}/functions/v1/twiml-voice?callId=${callId}`);
    formData.append('StatusCallback', `${supabaseUrl}/functions/v1/twiml-status?callId=${callId}`);
    // Fix the status callback events - use only valid events
    formData.append('StatusCallbackEvent', 'answered,completed');
    formData.append('StatusCallbackMethod', 'POST');
    formData.append('Timeout', '30'); // 30 second timeout for ringing
    formData.append('Record', 'false'); // Don't record calls for privacy
    
    console.log('Making Twilio API request to:', twilioUrl);
    console.log('TwiML URL:', `${supabaseUrl}/functions/v1/twiml-voice?callId=${callId}`);
    console.log('Status callback URL:', `${supabaseUrl}/functions/v1/twiml-status?callId=${callId}`);
    
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });

    console.log('Twilio API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Twilio API error response:', errorText);
      
      const { message, isGeoPermissionError } = parseTwilioError(errorText);
      
      let errorMessage = `Twilio API Error: ${message}`;
      
      // Provide specific guidance for geo-permission errors
      if (isGeoPermissionError) {
        errorMessage = `International calling not enabled for ${targetCountry}. 

To fix this issue:
1. Log into your Twilio Console at https://console.twilio.com
2. Navigate to Voice & SMS → Geo Permissions
3. Enable outbound calling permissions for ${targetCountry}
4. Wait a few minutes for the changes to take effect
5. Try making the call again

Original error: ${message}`;
      }
      
      // Update call record with error status
      await supabase
        .from('call_records')
        .update({ 
          status: 'failed',
          result_success: false,
          result_message: isGeoPermissionError ? 'Geographic permissions required' : 'Call initiation failed',
          result_details: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('id', callId);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage,
        errorType: isGeoPermissionError ? 'geo_permission' : 'twilio_api',
        targetCountry: targetCountry
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const callData = await response.json();
    console.log('Twilio call created successfully:', callData.sid);
    
    // Update call record with Twilio SID and status
    const { error: updateError } = await supabase
      .from('call_records')
      .update({ 
        status: 'dialing',
        // Store Twilio SID and call details for webhook access
        additional_context: JSON.stringify({
          originalContext: additionalContext || '',
          twilioSid: callData.sid,
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
        
        // If call is still in dialing state after 90 seconds, mark as failed
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
    }, 90000); // 90 seconds timeout

    return new Response(JSON.stringify({ 
      success: true, 
      twilioSid: callData.sid,
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