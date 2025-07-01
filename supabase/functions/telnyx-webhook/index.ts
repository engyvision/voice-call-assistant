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
  
  console.log(`🔗 Making Telnyx API call: ${method} ${endpoint}`);
  if (body) {
    console.log('📤 Request body:', JSON.stringify(body, null, 2));
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
    console.error('❌ Telnyx API error:', error);
    throw new Error(`Telnyx API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  console.log('📥 Telnyx API response:', JSON.stringify(result, null, 2));
  return result;
}

// Function to generate AI response using OpenAI
async function generateAIResponse(prompt: string, context: any) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not configured');
    throw new Error('OPENAI_API_KEY not configured');
  }
  
  console.log('🤖 Generating AI response for:', prompt.substring(0, 100) + '...');
  
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
- Keep responses concise (1-2 sentences max)
- Be specific about the call objective
- Ask clear questions when needed
- Thank the person for their time
- If the conversation objective is achieved or the person wants to end the call, politely conclude

CONVERSATION HISTORY:
${context.transcript.map(t => `${t.speaker === 'user' ? 'Person' : 'Assistant'}: ${t.text}`).join('\n')}

Respond naturally to what the person just said. Keep it brief and conversational.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0].message.content;
  console.log('✅ AI generated response:', aiResponse);
  return aiResponse;
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
    console.log('=== TELNYX WEBHOOK RECEIVED ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));

    // Get callId from URL parameters
    const url = new URL(req.url);
    const callId = url.searchParams.get('callId');
    
    console.log('📞 Call ID:', callId);

    if (!callId) {
      console.error('❌ Missing callId in webhook URL');
      return new Response('Missing callId', {
        status: 400,
        headers: corsHeaders
      });
    }

    // Handle test requests
    if (callId?.startsWith('test-')) {
      console.log('🧪 Test request to webhook');
      return new Response('Test OK - Telnyx webhook is accessible', {
        headers: corsHeaders
      });
    }

    // Parse webhook data
    const webhookData = await req.json();
    const eventType = webhookData.data?.event_type;
    const payload = webhookData.data?.payload;

    console.log('=== WEBHOOK EVENT DETAILS ===');
    console.log('🎯 Event Type:', eventType);
    console.log('📦 Full Payload:', JSON.stringify(webhookData, null, 2));

    if (!eventType || !payload) {
      console.error('❌ Invalid webhook payload - missing event_type or payload');
      return new Response('Invalid payload', {
        status: 400,
        headers: corsHeaders
      });
    }

    // Get call record from database
    const { data: currentCall, error: fetchError } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', callId)
      .single();

    if (fetchError || !currentCall) {
      console.error('❌ Call record not found:', fetchError);
      return new Response('Call record not found', {
        status: 404,
        headers: corsHeaders
      });
    }

    console.log('📋 Found call record:', {
      id: currentCall.id,
      recipient_name: currentCall.recipient_name,
      call_goal: currentCall.call_goal,
      status: currentCall.status
    });

    const callControlId = payload.call_control_id;
    let updateData: any = {};

    switch (eventType) {
      case 'call.initiated':
        console.log('📞 Call initiated event');
        updateData.status = 'dialing';
        break;

      case 'call.answered':
        console.log('✅ Call answered - starting AI conversation');
        updateData.status = 'in-progress';
        
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
        
        console.log('🎤 Starting conversation with initial message');
        
        try {
          // Use simple speak command first, then gather
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
        } catch (error) {
          console.error('❌ Error starting conversation:', error);
        }
        
        break;

      case 'call.speak.ended':
        console.log('🗣️ Speak ended - starting gather');
        
        try {
          // After speaking, start gathering user response
          await telnyxApiCall(`calls/${callControlId}/actions/gather`, 'POST', {
            input: ['speech'],
            speech_timeout_millis: 5000,
            speech_end_silence_timeout_millis: 2000,
            speech_language: 'en-US',
            speech_model: 'default'
          });
        } catch (error) {
          console.error('❌ Error starting gather:', error);
        }
        break;

      case 'call.gather.ended':
        console.log('🎯 Gather ended - processing user response');
        
        const gatherResult = payload.result;
        console.log('📊 Gather result:', JSON.stringify(gatherResult, null, 2));
        
        if (gatherResult && gatherResult.speech) {
          const userInput = gatherResult.speech;
          const state = conversationState.get(callId);
          
          if (state) {
            console.log('👤 User said:', userInput);
            
            // Add user input to transcript
            state.transcript.push({ speaker: 'user', text: userInput });
            state.turnCount++;
            
            // Check if conversation should end
            if (shouldEndConversation(userInput) || state.turnCount > 8) {
              console.log('🔚 Ending conversation');
              
              const farewell = "Thank you for your time. Have a great day!";
              
              await telnyxApiCall(`calls/${callControlId}/actions/speak`, 'POST', {
                payload: farewell,
                voice: 'Polly.Joanna-Neural',
                language: 'en-US'
              });
              
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
              
              console.log('🤖 AI response:', aiResponse);
              
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
              console.error('❌ Error generating AI response:', error);
              
              // Fallback response
              const fallbackResponse = "I apologize, I'm having a technical issue. Could you please repeat that?";
              
              await telnyxApiCall(`calls/${callControlId}/actions/speak`, 'POST', {
                payload: fallbackResponse,
                voice: 'Polly.Joanna-Neural',
                language: 'en-US'
              });
              
              if (state) {
                state.transcript.push({ speaker: 'assistant', text: fallbackResponse });
              }
            }
          }
        } else {
          console.log('⚠️ No speech detected, asking user to repeat');
          
          await telnyxApiCall(`calls/${callControlId}/actions/speak`, 'POST', {
            payload: "I didn't catch that. Could you please repeat?",
            voice: 'Polly.Joanna-Neural',
            language: 'en-US'
          });
        }
        break;

      case 'call.hangup':
        console.log('📴 Call hangup');
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
        
        console.log('📊 Call ended:', payload.hangup_cause, 'Duration:', duration);
        break;

      case 'call.machine.detection.ended':
        console.log('🤖 Machine detection result:', payload.result);
        // Handle answering machine detection
        if (payload.result === 'human') {
          console.log('✅ Human detected, continuing with conversation');
        } else {
          console.log('📞 Machine detected, ending call');
          await telnyxApiCall(`calls/${callControlId}/actions/hangup`, 'POST', {});
        }
        break;

      default:
        console.log('❓ Unhandled event type:', eventType);
        console.log('📦 Full event data:', JSON.stringify(webhookData, null, 2));
        break;
    }

    // Update database if there are changes
    if (Object.keys(updateData).length > 0) {
      console.log('💾 Updating database:', updateData);
      const { error: updateError } = await supabase
        .from('call_records')
        .update(updateData)
        .eq('id', callId);

      if (updateError) {
        console.error('❌ Failed to update call record:', updateError);
        return new Response('Database update failed', {
          status: 500,
          headers: corsHeaders
        });
      } else {
        console.log('✅ Database updated successfully');
      }
    }

    console.log('✅ Webhook processed successfully');
    return new Response('OK', {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('💥 Telnyx webhook error:', error);
    console.error('Stack trace:', error.stack);
    return new Response('Error', {
      status: 500,
      headers: corsHeaders
    });
  }
});