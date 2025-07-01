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

// Initialize conversation state storage
const conversationState = new Map();

// Helper function to make Telnyx API calls
async function telnyxApiCall(endpoint: string, method: string, body?: any) {
  const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY');
  
  if (!TELNYX_API_KEY) {
    throw new Error('TELNYX_API_KEY not configured');
  }
  
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
    throw new Error(`Telnyx API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Function to generate AI response using OpenAI
async function generateAIResponse(prompt: string, context: any) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  
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
          content: `You are a professional AI assistant making a phone call in English.
CALL OBJECTIVE: ${context.callGoal}
RECIPIENT: ${context.recipientName}
CONTEXT: ${context.additionalContext || 'No additional context'}

INSTRUCTIONS:
- Be polite, professional, and natural
- Keep responses concise (2-3 sentences max)
- Be specific about the call objective
- Ask clear questions when needed
- Thank the person for their time
- If the conversation objective is achieved or the person wants to end the call, politely conclude

CONVERSATION HISTORY:
${context.transcript.map(t => `${t.speaker === 'user' ? 'Person' : 'Assistant'}: ${t.text}`).join('\n')}

Respond naturally to what the person just said. If they seem ready to end the call or the objective is achieved, conclude politely.`
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
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Check if conversation should end
function shouldEndConversation(text: string): boolean {
  const endPhrases = [
    'goodbye', 'bye', 'thank you', 'thanks', 'have a good day', 
    'that\'s all', 'no thank you', 'not interested', 'busy right now'
  ];
  
  const lowerText = text.toLowerCase();
  return endPhrases.some(phrase => lowerText.includes(phrase));
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
          transcript: [],
          turnCount: 0
        });

        // Start the conversation with initial greeting
        const initialMessage = `Hello, this is an AI assistant calling on behalf of my client regarding ${currentCall.call_goal.toLowerCase()}. Am I speaking with ${currentCall.recipient_name}?`;
        
        // Use Telnyx speak command to say the greeting
        await telnyxApiCall(`calls/${callControlId}/actions/speak`, 'POST', {
          payload: initialMessage,
          voice: 'Polly.Joanna-Neural',
          language: 'en-US'
        });

        // Add initial message to transcript
        const state = conversationState.get(callId);
        if (state) {
          state.transcript.push({ speaker: 'assistant', text: initialMessage });
        }
        
        break;

      case 'call.speak.ended':
        console.log('AI finished speaking - gathering user input');
        
        // Start gathering user response after AI finishes speaking
        await telnyxApiCall(`calls/${callControlId}/actions/gather_using_speak`, 'POST', {
          speak: {
            payload: "Please go ahead.",
            voice: 'Polly.Joanna-Neural',
            language: 'en-US'
          },
          gather: {
            input: ['speech'],
            speech_timeout_millis: 5000,
            speech_end_silence_timeout_millis: 1500,
            speech_language: 'en-US',
            speech_model: 'default'
          }
        });
        break;

      case 'call.gather.ended':
        console.log('User finished speaking - processing response');
        
        if (payload.result && payload.result.speech) {
          const userInput = payload.result.speech;
          const state = conversationState.get(callId);
          
          if (state) {
            console.log('User said:', userInput);
            
            // Add user input to transcript
            state.transcript.push({ speaker: 'user', text: userInput });
            state.turnCount++;
            
            // Check if conversation should end
            if (shouldEndConversation(userInput) || state.turnCount > 10) {
              console.log('Ending conversation');
              
              const farewell = "Thank you for your time. Have a great day!";
              
              await telnyxApiCall(`calls/${callControlId}/actions/speak`, 'POST', {
                payload: farewell,
                voice: 'Polly.Joanna-Neural',
                language: 'en-US'
              });
              
              // Hang up after speaking
              setTimeout(async () => {
                try {
                  await telnyxApiCall(`calls/${callControlId}/actions/hangup`, 'POST', {});
                } catch (error) {
                  console.error('Error hanging up:', error);
                }
              }, 3000);
              
              state.transcript.push({ speaker: 'assistant', text: farewell });
              
              // Update transcript in database
              updateData.result_transcript = state.transcript
                .map(t => `${t.speaker === 'user' ? 'Person' : 'Assistant'}: ${t.text}`)
                .join('\n');
              
              break;
            }
            
            try {
              // Generate AI response
              const aiResponse = await generateAIResponse(userInput, state);
              state.transcript.push({ speaker: 'assistant', text: aiResponse });
              
              console.log('AI response:', aiResponse);
              
              // Update transcript in database
              updateData.result_transcript = state.transcript
                .map(t => `${t.speaker === 'user' ? 'Person' : 'Assistant'}: ${t.text}`)
                .join('\n');
              
              // Speak the AI response
              await telnyxApiCall(`calls/${callControlId}/actions/speak`, 'POST', {
                payload: aiResponse,
                voice: 'Polly.Joanna-Neural',
                language: 'en-US'
              });
              
            } catch (error) {
              console.error('Error generating AI response:', error);
              
              // Fallback response
              const fallbackResponse = "I apologize, I'm having a technical issue. Could you please repeat that?";
              
              await telnyxApiCall(`calls/${callControlId}/actions/speak`, 'POST', {
                payload: fallbackResponse,
                voice: 'Polly.Joanna-Neural',
                language: 'en-US'
              });
              
              state.transcript.push({ speaker: 'assistant', text: fallbackResponse });
            }
          }
        } else {
          console.log('No speech detected, asking user to repeat');
          
          await telnyxApiCall(`calls/${callControlId}/actions/speak`, 'POST', {
            payload: "I didn't catch that. Could you please repeat?",
            voice: 'Polly.Joanna-Neural',
            language: 'en-US'
          });
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
        
        console.log('Call ended:', payload.hangup_cause, 'Duration:', duration);
        break;

      case 'call.machine.detection.ended':
        // Handle answering machine detection
        if (payload.result === 'human') {
          console.log('Human detected, continuing with conversation');
        } else {
          console.log('Machine detected, ending call');
          await telnyxApiCall(`calls/${callControlId}/actions/hangup`, 'POST', {});
        }
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