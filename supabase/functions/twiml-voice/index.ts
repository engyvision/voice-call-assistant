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

// AI Configuration
const AI_PROVIDER = Deno.env.get('AI_PROVIDER') || 'openai';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY');

Deno.serve(async (req: Request) => {
  // Always allow OPTIONS requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('TwiML Voice webhook called:', {
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
      console.error('No callId provided in webhook URL');
      return new Response(generateErrorTwiML('Missing call identifier'), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Handle test requests (these come from our debug panel)
    if (callId?.startsWith('test-')) {
      console.log('Test request to voice webhook:', callId);
      return new Response(generateTestTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
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
      }
    } catch (error) {
      console.error('Failed to parse form data:', error);
      return new Response(generateErrorTwiML('Invalid request format'), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;

    console.log('Twilio webhook data:', { callId, callSid, callStatus, from, to });

    // Get call data from database using our callId
    const { data: callRecord, error } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', callId)
      .single();

    if (error || !callRecord) {
      console.error('Call record not found:', error);
      return new Response(generateErrorTwiML('Call record not found'), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    console.log('Found call record:', {
      id: callRecord.id,
      recipient_name: callRecord.recipient_name,
      call_goal: callRecord.call_goal
    });

    // Parse additional context to get call details
    let callDetails;
    try {
      callDetails = JSON.parse(callRecord.additional_context || '{}');
    } catch {
      callDetails = {
        originalContext: callRecord.additional_context || '',
        recipientName: callRecord.recipient_name,
        callGoal: callRecord.call_goal
      };
    }

    // Generate intelligent opening message using AI
    const openingMessage = await generateAIOpeningMessage(callRecord);

    // Create TwiML with AI-powered opening and speech gathering
    const twiml = generateIntelligentTwiML(openingMessage, callId);

    // Update call status in database (only for real calls, not tests)
    if (!callId.startsWith('test-')) {
      console.log('Updating call status to in-progress and initializing transcript');
      
      const { error: updateError } = await supabase
        .from('call_records')
        .update({ 
          status: 'in-progress',
          // Initialize transcript with opening message
          result_transcript: `Assistente: ${openingMessage}`,
          // Update additional context with Twilio SID
          additional_context: JSON.stringify({
            ...callDetails,
            twilioSid: callSid || 'test-sid'
          })
        })
        .eq('id', callId);

      if (updateError) {
        console.error('Failed to update call record:', updateError);
      } else {
        console.log('Successfully updated call record with opening message');
      }
    }

    console.log('Generated intelligent TwiML for call:', callId);

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });

  } catch (error) {
    console.error('TwiML voice webhook error:', error);
    return new Response(generateErrorTwiML('Internal server error'), {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });
  }
});

async function generateAIOpeningMessage(callRecord: any): Promise<string> {
  const { recipient_name, call_goal, additional_context } = callRecord;
  
  // Check if AI is configured
  if (!OPENAI_API_KEY && !CLAUDE_API_KEY) {
    console.log('No AI provider configured, using fallback message');
    return generateFallbackOpeningMessage(call_goal, recipient_name, additional_context);
  }

  try {
    const systemPrompt = `Você é um assistente de IA profissional fazendo uma ligação telefônica em português brasileiro.

OBJETIVO DA LIGAÇÃO: ${call_goal}
NOME DO DESTINATÁRIO: ${recipient_name}
CONTEXTO ADICIONAL: ${additional_context || 'Nenhum contexto adicional'}

INSTRUÇÕES PARA A MENSAGEM DE ABERTURA:
1. Seja educado, profissional e direto
2. Identifique-se como assistente de IA
3. Explique brevemente o motivo da ligação
4. Faça uma pergunta para iniciar a conversa
5. Mantenha a mensagem concisa (máximo 3 frases)
6. Use português brasileiro natural

Gere APENAS a mensagem de abertura que será falada ao atender o telefone.`;

    let aiResponse;
    
    if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
      aiResponse = await callOpenAI(systemPrompt);
    } else if (AI_PROVIDER === 'claude' && CLAUDE_API_KEY) {
      aiResponse = await callClaude(systemPrompt);
    } else {
      throw new Error('No valid AI provider configured');
    }

    console.log('AI generated opening message:', aiResponse);
    return aiResponse;

  } catch (error) {
    console.error('Failed to generate AI opening message:', error);
    return generateFallbackOpeningMessage(call_goal, recipient_name, additional_context);
  }
}

async function callOpenAI(systemPrompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Gere a mensagem de abertura para esta ligação telefônica.' }
      ],
      temperature: 0.7,
      max_tokens: 150,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

async function callClaude(systemPrompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLAUDE_API_KEY}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 150,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: 'Gere a mensagem de abertura para esta ligação telefônica.'
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const data = await response.json();
  return data.content[0]?.text?.trim() || '';
}

function generateFallbackOpeningMessage(callGoal: string, recipientName: string, additionalContext: string): string {
  const baseMessage = `Olá, aqui é um assistente de IA ligando em nome do meu cliente.`;
  
  // Create context-aware messages based on call goal
  switch (callGoal.toLowerCase()) {
    case 'book appointment':
    case 'agendar consulta':
    case 'marcar consulta':
      return `${baseMessage} Gostaria de agendar uma consulta. ${additionalContext ? additionalContext : 'Este é um bom momento para conversarmos sobre disponibilidade?'}`;
    
    case 'make reservation':
    case 'fazer reserva':
      return `${baseMessage} Gostaria de fazer uma reserva. ${additionalContext ? additionalContext : 'Vocês têm disponibilidade?'}`;
    
    case 'get information':
    case 'obter informação':
      return `${baseMessage} Estou ligando para obter algumas informações. ${additionalContext ? additionalContext : 'Você tem um momento para me ajudar?'}`;
    
    case 'follow up inquiry':
    case 'acompanhar consulta':
      return `${baseMessage} Estou fazendo um acompanhamento de uma consulta anterior. ${additionalContext ? additionalContext : 'Podemos conversar brevemente sobre isso?'}`;
    
    case 'schedule consultation':
    case 'agendar consulta':
      return `${baseMessage} Gostaria de agendar uma consulta. ${additionalContext ? additionalContext : 'Quais horários funcionam melhor para vocês?'}`;
    
    case 'request quote':
    case 'solicitar orçamento':
      return `${baseMessage} Estou ligando para solicitar um orçamento para serviços. ${additionalContext ? additionalContext : 'Vocês podem me ajudar com informações de preços?'}`;
    
    default:
      return `${baseMessage} ${additionalContext || 'Tenho uma solicitação para discutir com vocês. Vocês têm um momento?'}`;
  }
}

function generateIntelligentTwiML(openingMessage: string, callId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="pt-BR">${openingMessage}</Say>
  <Gather input="speech" action="${Deno.env.get('SUPABASE_URL')}/functions/v1/twiml-gather?callId=${callId}" method="POST" speechTimeout="3" timeout="10" language="pt-BR">
    <Say voice="alice" language="pt-BR">Por favor, me diga como posso ajudá-lo.</Say>
  </Gather>
  <Say voice="alice" language="pt-BR">Não consegui ouvir uma resposta. Obrigado pelo seu tempo e tenha um ótimo dia!</Say>
  <Hangup/>
</Response>`;
}

function generateTestTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="pt-BR">Esta é uma resposta de teste do webhook de voz TwiML. O endpoint está funcionando corretamente.</Say>
  <Hangup/>
</Response>`;
}

function generateErrorTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="pt-BR">Peço desculpas, mas parece haver um problema técnico: ${message}. Por favor, tente ligar novamente mais tarde.</Say>
  <Hangup/>
</Response>`;
}