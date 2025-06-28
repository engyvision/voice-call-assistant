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

    // Create Twilio call
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', phoneNumber);
    formData.append('From', TWILIO_PHONE_NUMBER);
    formData.append('Url', `${Deno.env.get('SUPABASE_URL')}/functions/v1/twiml-voice`);
    formData.append('StatusCallback', `${Deno.env.get('SUPABASE_URL')}/functions/v1/twiml-status`);
    formData.append('StatusCallbackEvent', 'initiated,ringing,answered,completed');
    formData.append('StatusCallbackMethod', 'POST');
    
    console.log('Making Twilio API request to:', twilioUrl);
    
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
      const error = await response.text();
      console.error('Twilio API error response:', error);
      
      // Try to parse the error for more specific information
      let errorMessage = 'Failed to initiate call';
      try {
        const errorData = JSON.parse(error);
        if (errorData.message) {
          errorMessage = `Twilio API Error: ${errorData.message}`;
        }
      } catch (parseError) {
        errorMessage = `Twilio API Error (${response.status}): ${error}`;
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const callData = await response.json();
    console.log('Twilio call created successfully:', callData.sid);
    
    // Update call record with Twilio SID
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: updateError } = await supabase
      .from('call_records')
      .update({ 
        status: 'dialing',
        // Store Twilio SID for reference
        additional_context: `${additionalContext || ''}\n\nTwilio SID: ${callData.sid}`
      })
      .eq('id', callId);

    if (updateError) {
      console.error('Failed to update call record:', updateError);
      // Don't fail the entire request if database update fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      twilioSid: callData.sid,
      callId: callId
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Call initiation error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Internal error: ${error.message}`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});