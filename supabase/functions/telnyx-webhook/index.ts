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

// Function to convert text to speech URL using AWS Polly (via Telnyx)
async function textToSpeechUrl(text: string, callControlId: string) {
  // Telnyx can handle TTS directly via the speak command
  return { text, voice: 'Polly.Joanna-Neural' };
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