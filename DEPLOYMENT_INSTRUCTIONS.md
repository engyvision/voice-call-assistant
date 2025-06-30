# 🚨 URGENT: Deploy Edge Functions to Fix Calls

## The Problem
Your calls aren't working because the Edge Functions aren't properly deployed. The error "Supabase project not connected" means you need to deploy them manually.

## ✅ IMMEDIATE FIX - Deploy via Supabase Dashboard

### Step 1: Deploy telnyx-initiate Function

1. **Go to**: [Supabase Dashboard](https://supabase.com/dashboard)
2. **Select your project**
3. **Navigate to**: Edge Functions (left sidebar)
4. **Click**: "Create Function"
5. **Function Name**: `telnyx-initiate`
6. **Copy this code** and paste it:

```typescript
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
    
    // Simple call payload - Telnyx doesn't support ai_config
    const callPayload = {
      connection_id: TELNYX_CONNECTION_ID,
      to: phoneNumber,
      from: TELNYX_PHONE_NUMBER,
      webhook_url: `${supabaseUrl}/functions/v1/telnyx-webhook?callId=${callId}`,
      webhook_url_method: 'POST',
      timeout_secs: 30
    };

    console.log('Telnyx call payload:', callPayload);

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
      data: responseData
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
    console.log('Call initiated successfully:', telnyxCallId);

    // Update call record with Telnyx call ID
    const { error: updateError } = await supabase
      .from('call_records')
      .update({ 
        status: 'dialing'
      })
      .eq('id', callId);

    if (updateError) {
      console.error('Failed to update call record:', updateError);
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
    console.error('Telnyx initiate error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to initiate call'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
```

7. **Click**: "Deploy Function"

### Step 2: Deploy telnyx-webhook Function

1. **Click**: "Create Function" again
2. **Function Name**: `telnyx-webhook`
3. **Copy this code** and paste it:

```typescript
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

// Initialize conversation state
const conversationState = new Map();

// Helper function to make Telnyx API calls
async function telnyxApiCall(endpoint: string, method: string, body?: any) {
  const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY');
  
  const response = await fetch(`https://api.telnyx.com/v2/${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Telnyx API error:', error);
    throw new Error(`Telnyx API error: ${response.status}`);
  }

  return response.json();
}

// Function to generate AI response using OpenAI
async function generateAIResponse(prompt: string, context: any) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional AI assistant making a phone call.
CALL OBJECTIVE: ${context.callGoal}
RECIPIENT: ${context.recipientName}
CONTEXT: ${context.additionalContext || 'No additional context'}

INSTRUCTIONS:
- Be polite, professional, and natural
- Keep responses concise (2-3 sentences max)
- Be specific about the call objective
- Ask clear questions when needed
- Thank the person for their time`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    })
  });

  if (!response.ok) {
    throw new Error('OpenAI API error');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

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
    
    if (!callId) {
      return new Response('Missing callId', {
        status: 400,
        headers: corsHeaders
      });
    }

    // Handle test requests
    if (callId?.startsWith('test-')) {
      return new Response('Test OK - Telnyx webhook is accessible', {
        headers: corsHeaders
      });
    }

    // Parse webhook data
    const webhookData = await req.json();
    const eventType = webhookData.data?.event_type;
    const payload = webhookData.data?.payload;

    if (!eventType || !payload) {
      return new Response('Invalid payload', {
        status: 400,
        headers: corsHeaders
      });
    }

    console.log('Webhook event:', eventType, 'for call:', callId);

    // Get call record from database
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

    const callControlId = payload.call_control_id;
    let updateData: any = {};

    switch (eventType) {
      case 'call.initiated':
        updateData.status = 'dialing';
        console.log('Call initiated');
        break;

      case 'call.answered':
        updateData.status = 'in-progress';
        console.log('Call answered - starting AI conversation');
        
        // Initialize conversation state
        conversationState.set(callId, {
          recipientName: currentCall.recipient_name,
          callGoal: currentCall.call_goal,
          additionalContext: currentCall.additional_context,
          transcript: []
        });

        // Start the conversation with initial greeting
        const initialMessage = `Hello, this is an AI assistant calling on behalf of my client regarding ${currentCall.call_goal.toLowerCase()}. Am I speaking with ${currentCall.recipient_name}?`;
        
        // Use Telnyx speak command to say the greeting
        await telnyxApiCall(`calls/${callControlId}/actions/speak`, 'POST', {
          payload: initialMessage,
          voice: 'Polly.Joanna-Neural',
          language: 'en-US'
        });

        // After speaking, start gathering user response
        await telnyxApiCall(`calls/${callControlId}/actions/gather`, 'POST', {
          minimum_digit_count: 0,
          maximum_digit_count: 0,
          timeout_millis: 30000,
          inter_digit_timeout_millis: 5000,
          speech_model: 'deepgram',
          speech_timeout_millis: 5000
        });
        
        break;

      case 'call.speak.ended':
        console.log('AI finished speaking - gathering user input');
        
        // Start gathering user response after AI finishes speaking
        await telnyxApiCall(`calls/${callControlId}/actions/gather`, 'POST', {
          minimum_digit_count: 0,
          maximum_digit_count: 0,
          timeout_millis: 30000,
          inter_digit_timeout_millis: 5000,
          speech_model: 'deepgram',
          speech_timeout_millis: 5000
        });
        break;

      case 'call.gather.ended':
        console.log('User finished speaking - processing response');
        
        if (payload.speech_result) {
          const userInput = payload.speech_result;
          const state = conversationState.get(callId);
          
          if (state) {
            // Add to transcript
            state.transcript.push({ speaker: 'user', text: userInput });
            
            // Generate AI response
            const aiResponse = await generateAIResponse(userInput, state);
            state.transcript.push({ speaker: 'assistant', text: aiResponse });
            
            // Update transcript in database
            updateData.result_transcript = state.transcript
              .map(t => `${t.speaker === 'user' ? 'Pessoa' : 'Assistente'}: ${t.text}`)
              .join('\n');
            
            // Speak the AI response
            await telnyxApiCall(`calls/${callControlId}/actions/speak`, 'POST', {
              payload: aiResponse,
              voice: 'Polly.Joanna-Neural',
              language: 'en-US'
            });
          }
        }
        break;

      case 'call.hangup':
        const duration = payload.hangup_cause === 'normal_clearing' ? 
          Math.floor((Date.now() - new Date(currentCall.created_at).getTime()) / 1000) : 0;
        
        updateData.status = 'completed';
        updateData.duration = duration;
        updateData.completed_at = new Date().toISOString();
        updateData.result_success = duration > 10;
        updateData.result_message = payload.hangup_cause === 'normal_clearing' ? 
          'Call completed successfully' : `Call ended: ${payload.hangup_cause}`;
        
        // Clean up conversation state
        conversationState.delete(callId);
        
        console.log('Call ended:', payload.hangup_cause);
        break;

      default:
        console.log('Unhandled event type:', eventType);
        break;
    }

    // Update database if there are changes
    if (Object.keys(updateData).length > 0) {
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
      }
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
```

4. **Click**: "Deploy Function"

### Step 3: Set Environment Variables

1. **Go to**: Edge Functions → Settings
2. **Add these environment variables**:

```bash
TELNYX_API_KEY=your_telnyx_api_key
TELNYX_CONNECTION_ID=your_telnyx_connection_id
TELNYX_PHONE_NUMBER=+351210600099
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 4: Test the Deployment

1. **Wait 2-3 minutes** for deployment to complete
2. **Go to your app** → Diagnostics tab
3. **Click**: "Run Full Diagnostics"
4. **Verify**: Both functions show as accessible
5. **Make a test call** to verify everything works

## ✅ After Deployment

Your calls should work immediately after:
1. ✅ Both functions are deployed
2. ✅ Environment variables are set
3. ✅ 2-3 minutes have passed for propagation

## 🔍 If Still Not Working

Check these in order:
1. **Function logs** in Supabase Dashboard → Edge Functions → [function name] → Logs
2. **Environment variables** are all set correctly
3. **Telnyx webhook URL** in Telnyx Portal matches your Supabase project URL
4. **API keys** are valid and have sufficient credits

The main issue was that your Edge Functions weren't deployed, which is why calls weren't working. This manual deployment should fix it immediately.