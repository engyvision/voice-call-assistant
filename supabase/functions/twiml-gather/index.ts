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

interface ConversationTurn {
  timestamp: string;
  speaker: 'ai' | 'human';
  text: string;
  confidence?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('TwiML Gather webhook called:', {
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
      console.error('No callId provided in gather webhook URL');
      return new Response(generateErrorTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Handle test requests (these come from our debug panel)
    if (callId?.startsWith('test-')) {
      console.log('Test request to gather webhook:', callId);
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
        // For GET requests (like our tests), return test TwiML
        return new Response(generateTestTwiML(), {
          headers: { 'Content-Type': 'text/xml', ...corsHeaders }
        });
      }
    } catch (error) {
      console.error('Failed to parse form data:', error);
      return new Response(generateErrorTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }
    
    const callSid = formData.get('CallSid') as string;
    const speechResult = formData.get('SpeechResult') as string;
    const confidence = formData.get('Confidence') as string;

    console.log('Speech gathered:', { callId, callSid, speechResult, confidence });

    // Get call record
    const { data: callRecord } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', callId)
      .single();

    if (!callRecord) {
      console.error('Call record not found for callId:', callId);
      return new Response(generateErrorTwiML(), {
        headers: { 'Content-Type': 'text/xml', ...corsHeaders }
      });
    }

    // Get current conversation history
    const conversationHistory = parseConversationHistory(callRecord.result_transcript || '');

    // Process speech with AI to generate intelligent response
    const aiResponse = await processWithAI(speechResult, callRecord, conversationHistory);
    
    // Generate appropriate TwiML response based on AI decision
    const twiml = generateResponseTwiML(aiResponse, callId);

    // Update call record with conversation progress (only for real calls)
    if (!callId.startsWith('test-')) {
      await updateCallProgress(callId, speechResult, aiResponse, conversationHistory);
    }

    console.log('Generated AI response:', aiResponse);

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });

  } catch (error) {
    console.error('TwiML gather error:', error);
    return new Response(generateErrorTwiML(), {
      headers: { 'Content-Type': 'text/xml', ...corsHeaders }
    });
  }
});

async function processWithAI(
  userSpeech: string, 
  callRecord: any, 
  conversationHistory: ConversationTurn[]
): Promise<{ text: string; shouldContinue: boolean }> {
  
  // Check if AI is configured
  if (!OPENAI_API_KEY && !CLAUDE_API_KEY) {
    console.log('No AI provider configured, using rule-based response');
    return {
      text: generateRuleBasedResponse(userSpeech, callRecord),
      shouldContinue: !shouldEndCall(userSpeech)
    };
  }

  try {
    const systemPrompt = buildSystemPrompt(callRecord);
    const conversationText = formatConversationHistory(conversationHistory);

    let aiResponse;
    if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
      aiResponse = await callOpenAI(systemPrompt, conversationText, userSpeech);
    } else if (AI_PROVIDER === 'claude' && CLAUDE_API_KEY) {
      aiResponse = await callClaude(systemPrompt, conversationText, userSpeech);
    } else {
      throw new Error('No valid AI provider configured');
    }

    console.log('AI generated response:', aiResponse);

    return {
      text: aiResponse,
      shouldContinue: !shouldEndCall(aiResponse)
    };

  } catch (error) {
    console.error('AI processing error:', error);
    return {
      text: generateFallbackResponse(userSpeech, callRecord),
      shouldContinue: true
    };
  }
}

function buildSystemPrompt(callRecord: any): string {
  return `Você é um assistente de IA profissional fazendo uma ligação telefônica em português brasileiro.

OBJETIVO DA LIGAÇÃO: ${callRecord.call_goal}
NOME DO DESTINATÁRIO: ${callRecord.recipient_name}
CONTEXTO ADICIONAL: ${callRecord.additional_context || 'Nenhum contexto adicional'}

INSTRUÇÕES IMPORTANTES:
1. Seja educado, profissional e natural
2. Fale em português brasileiro claro e natural
3. Mantenha respostas concisas (máximo 2-3 frases)
4. Seja específico sobre o objetivo da ligação
5. Faça perguntas claras quando precisar de informações
6. Confirme informações importantes
7. Agradeça sempre pela atenção

REGRAS DE CONVERSA:
- Se não entender algo, peça para repetir educadamente
- Se a pessoa estiver ocupada, ofereça para ligar em outro momento
- Se conseguir o objetivo, confirme os detalhes e agradeça
- Se não conseguir, agradeça e termine educadamente
- Responda de forma natural e conversacional
- Adapte-se ao tom e estilo da pessoa

FORMATO DE RESPOSTA:
- Responda apenas com o texto que deve ser falado
- Não inclua ações ou descrições entre parênteses
- Mantenha tom conversacional e natural
- Use linguagem apropriada para o contexto

Lembre-se: Você está representando seu cliente, seja profissional e eficiente.`;
}

function formatConversationHistory(history: ConversationTurn[]): string {
  return history.map(turn => {
    const speaker = turn.speaker === 'ai' ? 'Assistente' : 'Pessoa';
    return `${speaker}: ${turn.text}`;
  }).join('\n');
}

async function callOpenAI(
  systemPrompt: string,
  conversationHistory: string,
  userInput: string
): Promise<string> {
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
        { 
          role: 'user', 
          content: `Histórico da conversa:\n${conversationHistory}\n\nÚltima fala da pessoa: "${userInput}"\n\nResponda naturalmente em português como um assistente profissional:` 
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

async function callClaude(
  systemPrompt: string,
  conversationHistory: string,
  userInput: string
): Promise<string> {
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
          content: `Histórico da conversa:\n${conversationHistory}\n\nÚltima fala da pessoa: "${userInput}"\n\nResponda naturalmente em português como um assistente profissional:`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0]?.text?.trim() || '';
}

function generateRuleBasedResponse(userSpeech: string, callRecord: any): string {
  const { call_goal, recipient_name } = callRecord;
  const lowerSpeech = userSpeech.toLowerCase();
  
  // Basic rule-based responses for common scenarios
  if (lowerSpeech.includes('sim') || lowerSpeech.includes('pode') || lowerSpeech.includes('claro')) {
    if (call_goal.includes('appointment') || call_goal.includes('consulta')) {
      return "Ótimo! Gostaria de agendar para a próxima semana. Que dias e horários funcionam melhor para vocês?";
    } else if (call_goal.includes('reservation') || call_goal.includes('reserva')) {
      return "Perfeito! Gostaria de fazer uma reserva. Que disponibilidade vocês têm?";
    } else if (call_goal.includes('information') || call_goal.includes('informação')) {
      return "Obrigado. Vocês poderiam me fornecer as informações que solicitei?";
    }
  }
  
  if (lowerSpeech.includes('não') || lowerSpeech.includes('ocupado') || lowerSpeech.includes('agora não')) {
    return "Entendo que vocês estão ocupados. Quando seria um melhor momento para ligar de volta?";
  }
  
  if (lowerSpeech.includes('quem') || lowerSpeech.includes('empresa')) {
    return "Sou um assistente de IA ligando em nome do meu cliente para " + call_goal.toLowerCase() + ". Vocês podem me ajudar?";
  }
  
  if (lowerSpeech.includes('horário') || lowerSpeech.includes('quando')) {
    return "Que horários funcionam melhor para vocês? Temos flexibilidade durante a semana.";
  }
  
  return "Obrigado por essa informação. Deixe-me ajudá-lo com sua solicitação.";
}

function generateFallbackResponse(userSpeech: string, callRecord: any): string {
  return "Desculpe, tive um problema técnico. Pode repetir o que disse, por favor?";
}

function parseConversationHistory(transcript: string): ConversationTurn[] {
  if (!transcript) return [];
  
  const lines = transcript.split('\n').filter(line => line.trim());
  const history: ConversationTurn[] = [];
  
  for (const line of lines) {
    if (line.startsWith('Assistente:')) {
      history.push({
        timestamp: new Date().toISOString(),
        speaker: 'ai',
        text: line.replace('Assistente:', '').trim(),
        confidence: 0.9
      });
    } else if (line.startsWith('Pessoa:')) {
      history.push({
        timestamp: new Date().toISOString(),
        speaker: 'human',
        text: line.replace('Pessoa:', '').trim(),
        confidence: 0.9
      });
    }
  }
  
  return history;
}

function generateResponseTwiML(aiResponse: { text: string; shouldContinue: boolean }, callId: string): string {
  if (aiResponse.shouldContinue) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="pt-BR">${aiResponse.text}</Say>
  <Gather input="speech" action="${Deno.env.get('SUPABASE_URL')}/functions/v1/twiml-gather?callId=${callId}" method="POST" speechTimeout="3" timeout="10" language="pt-BR">
    <Say voice="alice" language="pt-BR">Por favor, continue.</Say>
  </Gather>
  <Say voice="alice" language="pt-BR">Obrigado pelo seu tempo. Tenha um ótimo dia!</Say>
  <Hangup/>
</Response>`;
  } else {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="pt-BR">${aiResponse.text}</Say>
  <Hangup/>
</Response>`;
  }
}

function generateTestTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="pt-BR">Esta é uma resposta de teste do webhook de coleta TwiML. O endpoint está funcionando corretamente.</Say>
  <Hangup/>
</Response>`;
}

async function updateCallProgress(
  callId: string, 
  userSpeech: string, 
  aiResponse: { text: string; shouldContinue: boolean }, 
  currentHistory: ConversationTurn[]
): Promise<void> {
  const newHistory = [
    ...currentHistory,
    {
      timestamp: new Date().toISOString(),
      speaker: 'human' as const,
      text: userSpeech,
      confidence: 0.9
    },
    {
      timestamp: new Date().toISOString(),
      speaker: 'ai' as const,
      text: aiResponse.text,
      confidence: 0.9
    }
  ];

  // Update the call record with new conversation history
  const transcript = newHistory.map(turn => 
    `${turn.speaker === 'ai' ? 'Assistente' : 'Pessoa'}: ${turn.text}`
  ).join('\n');

  await supabase
    .from('call_records')
    .update({ 
      result_transcript: transcript,
      status: 'in-progress'
    })
    .eq('id', callId);
}

function shouldEndCall(text: string): boolean {
  const endPhrases = [
    'obrigado',
    'tchau',
    'até logo',
    'tenha um bom dia',
    'boa tarde',
    'boa noite',
    'encerrar',
    'finalizar',
    'até mais',
    'desligar'
  ];
  
  const lowerText = text.toLowerCase();
  return endPhrases.some(phrase => lowerText.includes(phrase));
}

function generateErrorTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="pt-BR">Peço desculpas, mas parece haver um problema técnico. Por favor, tente ligar novamente mais tarde.</Say>
  <Hangup/>
</Response>`;
}