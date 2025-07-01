import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Helper function to get country from phone number
function getCountryFromPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.startsWith('+1')) return 'United States';
  if (phoneNumber.startsWith('+351')) return 'Portugal';
  if (phoneNumber.startsWith('+44')) return 'United Kingdom';
  if (phoneNumber.startsWith('+33')) return 'France';
  if (phoneNumber.startsWith('+49')) return 'Germany';
  if (phoneNumber.startsWith('+34')) return 'Spain';
  if (phoneNumber.startsWith('+39')) return 'Italy';
  if (phoneNumber.startsWith('+31')) return 'Netherlands';
  if (phoneNumber.startsWith('+46')) return 'Sweden';
  if (phoneNumber.startsWith('+47')) return 'Norway';
  if (phoneNumber.startsWith('+45')) return 'Denmark';
  if (phoneNumber.startsWith('+358')) return 'Finland';
  if (phoneNumber.startsWith('+48')) return 'Poland';
  if (phoneNumber.startsWith('+420')) return 'Czech Republic';
  if (phoneNumber.startsWith('+43')) return 'Austria';
  if (phoneNumber.startsWith('+41')) return 'Switzerland';
  if (phoneNumber.startsWith('+32')) return 'Belgium';
  if (phoneNumber.startsWith('+30')) return 'Greece';
  if (phoneNumber.startsWith('+353')) return 'Ireland';
  return 'Unknown';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get Telnyx credentials
    const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY');
    const TELNYX_CONNECTION_ID = Deno.env.get('TELNYX_CONNECTION_ID');
    const TELNYX_PHONE_NUMBER = Deno.env.get('TELNYX_PHONE_NUMBER');

    console.log('=== TELNYX INITIATE DEBUG ===');
    console.log('Environment check:', {
      TELNYX_API_KEY: !!TELNYX_API_KEY,
      TELNYX_CONNECTION_ID: !!TELNYX_CONNECTION_ID,
      TELNYX_PHONE_NUMBER: !!TELNYX_PHONE_NUMBER,
      SUPABASE_URL: !!Deno.env.get('SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    });

    // Validate Telnyx configuration
    if (!TELNYX_API_KEY || !TELNYX_CONNECTION_ID || !TELNYX_PHONE_NUMBER) {
      console.error('Missing Telnyx credentials:', {
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

    console.log('Initiating Telnyx call:', { 
      callId, 
      phoneNumber, 
      recipientName,
      callGoal: callGoal?.substring(0, 50) + '...'
    });

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get country information for better error messages
    const targetCountry = getCountryFromPhoneNumber(phoneNumber);
    console.log('Target country detected:', targetCountry);

    // Create Telnyx call with simplified configuration
    const telnyxUrl = 'https://api.telnyx.com/v2/calls';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    
    // Simplified call payload - remove machine detection for now to avoid issues
    const callPayload = {
      connection_id: TELNYX_CONNECTION_ID,
      to: phoneNumber,
      from: TELNYX_PHONE_NUMBER,
      webhook_url: `${supabaseUrl}/functions/v1/telnyx-webhook?callId=${callId}`,
      webhook_url_method: 'POST',
      timeout_secs: 30,
      // Disable machine detection for now to ensure calls go through
      answering_machine_detection: 'disabled'
    };

    console.log('Telnyx call payload:', JSON.stringify(callPayload, null, 2));

    // Make the API call to Telnyx
    const response = await fetch(telnyxUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callPayload),
    });

    const responseData = await response.json();
    console.log('Telnyx API response:', {
      status: response.status,
      ok: response.ok,
      data: JSON.stringify(responseData, null, 2)
    });

    if (!response.ok) {
      // Handle specific Telnyx error codes
      let errorMessage = responseData.errors?.[0]?.detail || responseData.message || 'Unknown Telnyx error';
      let userFriendlyError = errorMessage;

      if (response.status === 401) {
        userFriendlyError = 'Telnyx authentication failed. Please check your API key.';
      } else if (response.status === 422) {
        if (errorMessage.includes('connection_id')) {
          userFriendlyError = 'Invalid Telnyx connection ID. Please verify your Voice API connection in the Telnyx portal.';
        } else if (errorMessage.includes('permissions')) {
          userFriendlyError = `Call permissions not enabled for ${targetCountry}. Please enable this country in your Telnyx Outbound Voice Profile.`;
        } else if (errorMessage.includes('from')) {
          userFriendlyError = 'Invalid source phone number. Please verify your Telnyx phone number configuration.';
        }
      } else if (response.status === 503) {
        userFriendlyError = 'Telnyx service temporarily unavailable. Please try again in a few moments.';
      }

      console.error('Telnyx API error:', {
        status: response.status,
        error: errorMessage,
        details: responseData
      });

      return new Response(JSON.stringify({ 
        success: false, 
        error: userFriendlyError,
        details: errorMessage
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Extract call control ID from response
    const telnyxCallId = responseData.data.call_control_id;
    console.log('✅ Call initiated successfully:', telnyxCallId);

    // Update call record with Telnyx call ID
    const { error: updateError } = await supabase
      .from('call_records')
      .update({ 
        status: 'dialing',
        additional_context: JSON.stringify({
          originalContext: additionalContext || '',
          telnyxCallId: telnyxCallId,
          recipientName: recipientName,
          callGoal: callGoal
        })
      })
      .eq('id', callId);

    if (updateError) {
      console.error('Failed to update call record:', updateError);
    } else {
      console.log('✅ Updated call record with Telnyx call ID');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      callId: telnyxCallId,
      message: 'Call initiated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('💥 Telnyx initiate error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to initiate call'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});