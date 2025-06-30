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
const AI_MODEL = Deno.env.get('AI_MODEL') || 'gpt-4';
const AI_TEMPERATURE = parseFloat(Deno.env.get('AI_TEMPERATURE') || '0.7');
const AI_MAX_TOKENS = parseInt(Deno.env.get('AI_MAX_TOKENS') || '150');

// ElevenLabs Configuration
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const ELEVENLABS_VOICE_ID = Deno.env.get('ELEVENLABS_VOICE_ID');

interface ConversationTurn {
  timestamp: string;
  speaker: 'ai' | 'human';
  text: string;
  confidence?: number;
}

interface AIResponse {
  text: string;
  intent?: string;
  confidence: number;
  shouldContinue: boolean;
  nextAction?: 'gather_info' | 'confirm' | 'end_call' | 'clarify';
  needsAssistance?: boolean;
  assistanceQuestion?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('AI Conversation endpoint called:', {
      method: req.method,
      url: req.url
    });

    const { callId, userInput, conversationHistory, isAssistantInput } = await req.json();

    if (!callId || !userInput) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters: callId and userInput'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get call record for context
    const { data: callRecord, error: callError } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', callId)
      .single();

    if (callError || !callRecord) {
      console.error('Call record not found:', callError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Call record not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Generate AI response
    const aiResponse = await generateAIResponse(
      callRecord,
      userInput,
      conversationHistory || [],
      isAssistantInput || false
    );

    // Generate voice audio if needed
    let voiceResponse = null;
    if (!isAssistantInput) {
      voiceResponse = await generateVoiceAudio(aiResponse.text);
    }

    // Update conversation history in database
    await updateConversationHistory(callId, userInput, aiResponse.text, conversationHistory || [], isAssistantInput);

    // Check if AI needs assistance and create a pending question
    if (aiResponse.needsAssistance && aiResponse.assistanceQuestion) {
      await createPendingQuestion(callId, aiResponse.assistanceQuestion, userInput);
    }

    return new Response(JSON.stringify({
      success: true,
      aiResponse,
      voiceResponse,
      shouldContinue: aiResponse.shouldContinue,
      needsAssistance: aiResponse.needsAssistance,
      assistanceQuestion: aiResponse.assistanceQuestion
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('AI Conversation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});

async function generateAIResponse(
  callRecord: any,
  userInput: string,
  conversationHistory: ConversationTurn[],
  isAssistantInput: boolean = false
): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt(callRecord);
  const conversationText = formatConversationHistory(conversationHistory);

  try {
    if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
      return await callOpenAI(systemPrompt, conversationText, userInput, isAssistantInput);
    } else if (AI_PROVIDER === 'claude' && CLAUDE_API_KEY) {
      return await callClaude(systemPrompt, conversationText, userInput, isAssistantInput);
    } else {
      throw new Error('No AI provider configured');
    }
  } catch (error) {
    console.error('AI generation error:', error);
    
    // Fallback response
    return {
      text: "Desculpe, tive um problema técnico. Pode repetir o que disse?",
      confidence: 0.1,
      shouldContinue: true,
      nextAction: 'clarify'
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
8. Se não souber uma informação específica, seja honesto sobre isso

QUANDO PRECISAR DE AJUDA:
- Se a pessoa perguntar sobre preços, horários específicos, disponibilidade ou detalhes que você não tem
- Se precisar de informações técnicas específicas sobre produtos/serviços
- Se a pessoa fizer uma pergunta que requer conhecimento interno da empresa
- Diga algo como "Deixe-me verificar essa informação para você" e continue a conversa

REGRAS DE CONVERSA:
- Se não entender algo, peça para repetir educadamente
- Se a pessoa estiver ocupada, ofereça para ligar em outro momento
- Se conseguir o objetivo, confirme os detalhes e agradeça
- Se não conseguir, agradeça e termine educadamente
- Se não souber uma resposta, seja honesto mas mantenha a conversa fluindo

FORMATO DE RESPOSTA:
- Responda apenas com o texto que deve ser falado
- Não inclua ações ou descrições entre parênteses
- Mantenha tom conversacional e natural

Lembre-se: Você está representando seu cliente, seja profissional e eficiente. É melhor admitir que não sabe algo do que inventar informações.`;
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
  userInput: string,
  isAssistantInput: boolean
): Promise<AIResponse> {
  const inputPrefix = isAssistantInput ? '[INFORMAÇÃO FORNECIDA PELO OPERADOR] ' : '';
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Histórico da conversa:\n${conversationHistory}\n\nÚltima fala da pessoa: ${inputPrefix}${userInput}\n\nResponda naturalmente em português:` 
        }
      ],
      temperature: AI_TEMPERATURE,
      max_tokens: AI_MAX_TOKENS,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const aiText = data.choices[0]?.message?.content?.trim() || '';

  // Check if AI needs assistance
  const needsAssistance = checkIfNeedsAssistance(aiText, userInput);
  const assistanceQuestion = needsAssistance ? extractAssistanceQuestion(userInput) : undefined;

  return {
    text: aiText,
    confidence: 0.9,
    shouldContinue: !shouldEndCall(aiText),
    intent: extractIntent(aiText),
    nextAction: determineNextAction(aiText),
    needsAssistance,
    assistanceQuestion
  };
}

async function callClaude(
  systemPrompt: string,
  conversationHistory: string,
  userInput: string,
  isAssistantInput: boolean
): Promise<AIResponse> {
  const inputPrefix = isAssistantInput ? '[INFORMAÇÃO FORNECIDA PELO OPERADOR] ' : '';
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLAUDE_API_KEY}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      temperature: AI_TEMPERATURE,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Histórico da conversa:\n${conversationHistory}\n\nÚltima fala da pessoa: ${inputPrefix}${userInput}\n\nResponda naturalmente em português:`
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const data = await response.json();
  const aiText = data.content[0]?.text?.trim() || '';

  // Check if AI needs assistance
  const needsAssistance = checkIfNeedsAssistance(aiText, userInput);
  const assistanceQuestion = needsAssistance ? extractAssistanceQuestion(userInput) : undefined;

  return {
    text: aiText,
    confidence: 0.9,
    shouldContinue: !shouldEndCall(aiText),
    intent: extractIntent(aiText),
    nextAction: determineNextAction(aiText),
    needsAssistance,
    assistanceQuestion
  };
}

function checkIfNeedsAssistance(aiResponse: string, userInput: string): boolean {
  const uncertaintyPhrases = [
    'não tenho essa informação',
    'preciso verificar',
    'não sei',
    'vou precisar consultar',
    'não tenho certeza',
    'deixe-me verificar',
    'preciso confirmar'
  ];

  const questionTypes = [
    'quanto custa',
    'qual o preço',
    'que horas',
    'quando',
    'vocês têm',
    'está disponível',
    'how much',
    'what time',
    'do you have',
    'is available'
  ];

  const aiLower = aiResponse.toLowerCase();
  const userLower = userInput.toLowerCase();

  // Check if AI expressed uncertainty
  const aiUncertain = uncertaintyPhrases.some(phrase => aiLower.includes(phrase));
  
  // Check if user asked a specific question that might need assistance
  const userAskedSpecificQuestion = questionTypes.some(type => userLower.includes(type));

  return aiUncertain || userAskedSpecificQuestion;
}

function extractAssistanceQuestion(userInput: string): string {
  // Extract the core question from user input
  const questionMarkers = ['quanto', 'qual', 'quando', 'onde', 'como', 'vocês têm', 'está disponível'];
  
  for (const marker of questionMarkers) {
    if (userInput.toLowerCase().includes(marker)) {
      return `Customer asked: "${userInput}" - Please provide the specific information needed.`;
    }
  }
  
  return `Customer inquiry: "${userInput}" - Please provide relevant information.`;
}

async function generateVoiceAudio(text: string): Promise<any> {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    return {
      success: false,
      error: 'ElevenLabs not configured'
    };
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: cleanTextForSpeech(text),
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.85,
          style: 0.2,
          use_speaker_boost: true
        },
        language_code: 'pt-BR'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${errorText}`);
    }

    const audioData = await response.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData)));

    return {
      success: true,
      audioBase64: base64Audio,
      duration: estimateAudioDuration(text)
    };

  } catch (error) {
    console.error('Voice synthesis error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\bDr\./g, 'Doutor')
    .replace(/\bDra\./g, 'Doutora')
    .replace(/\bSr\./g, 'Senhor')
    .replace(/\bSra\./g, 'Senhora')
    .replace(/([.!?])\s*$/, '$1')
    .replace(/([.!?])\s+/g, '$1 ')
    .trim();
}

function estimateAudioDuration(text: string): number {
  const words = text.split(/\s+/).length;
  const wordsPerMinute = 165; // Portuguese speaking rate
  const durationMinutes = words / wordsPerMinute;
  return Math.ceil(durationMinutes * 60);
}

async function updateConversationHistory(
  callId: string,
  userInput: string,
  aiResponse: string,
  currentHistory: ConversationTurn[],
  isAssistantInput: boolean = false
): Promise<void> {
  const newHistory = [...currentHistory];
  
  if (!isAssistantInput) {
    // Add human input
    newHistory.push({
      timestamp: new Date().toISOString(),
      speaker: 'human' as const,
      text: userInput,
      confidence: 0.9
    });
  }
  
  // Add AI response
  newHistory.push({
    timestamp: new Date().toISOString(),
    speaker: 'ai' as const,
    text: aiResponse,
    confidence: 0.9
  });

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

async function createPendingQuestion(callId: string, question: string, context: string): Promise<void> {
  // Store pending questions in a separate table or as part of call record
  // For now, we'll add it to the additional_context field
  const { data: callRecord } = await supabase
    .from('call_records')
    .select('additional_context')
    .eq('id', callId)
    .single();

  if (callRecord) {
    let contextData;
    try {
      contextData = JSON.parse(callRecord.additional_context || '{}');
    } catch {
      contextData = { originalContext: callRecord.additional_context || '' };
    }

    if (!contextData.pendingQuestions) {
      contextData.pendingQuestions = [];
    }

    contextData.pendingQuestions.push({
      id: Date.now().toString(),
      question,
      context,
      timestamp: new Date().toISOString(),
      answered: false
    });

    await supabase
      .from('call_records')
      .update({ additional_context: JSON.stringify(contextData) })
      .eq('id', callId);
  }
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
    'finalizar'
  ];
  
  const lowerText = text.toLowerCase();
  return endPhrases.some(phrase => lowerText.includes(phrase));
}

function extractIntent(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('agendar') || lowerText.includes('marcar')) return 'schedule';
  if (lowerText.includes('informação') || lowerText.includes('saber')) return 'information';
  if (lowerText.includes('confirmar')) return 'confirm';
  if (lowerText.includes('cancelar')) return 'cancel';
  if (lowerText.includes('reagendar')) return 'reschedule';
  
  return 'general';
}

function determineNextAction(text: string): 'gather_info' | 'confirm' | 'end_call' | 'clarify' {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('?')) return 'gather_info';
  if (lowerText.includes('confirmar') || lowerText.includes('certo')) return 'confirm';
  if (shouldEndCall(text)) return 'end_call';
  
  return 'clarify';
}