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

    // Check if this looks like a Twilio request
    const userAgent = req.headers.get('user-agent') || '';
    const isTwilioRequest = userAgent.includes('TwilioProxy') || userAgent.includes('Twilio');
    const hasTwilioSignature = req.headers.get('x-twilio-signature');
    
    console.log('Request analysis:', { isTwilioRequest, hasTwilioSignature: !!hasTwilioSignature });

    // Accept requests from Twilio (with signature) or allow all for now to debug
    // In production, you should validate the Twilio signature
    if (!isTwilioRequest && !hasTwilioSignature) {
      console.log('Non-Twilio request without signature - allowing for debugging');
      // For debugging, we'll allow these requests but log them
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

    // Generate intelligent TwiML with AI integration
    const twiml = await generateIntelligentTwiML(callRecord, callDetails, callId);

    // Update call status in database (only for real calls, not tests)
    if (!callId.startsWith('test-')) {
      const { error: updateError } = await supabase
        .from('call_records')
        .update({ 
          status: 'in-progress',
          // Update additional context with Twilio SID
          additional_context: JSON.stringify({
            ...callDetails,
            twilioSid: callSid || 'test-sid'
          })
        })
        .eq('id', callId);

      if (updateError) {
        console.error('Failed to update call record:', updateError);
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

async function generateIntelligentTwiML(callRecord: any, callDetails: any, callId: string): Promise<string> {
  const { recipient_name, call_goal } = callRecord;
  const { originalContext } = callDetails;
  
  // Create intelligent initial message based on call goal and context
  const initialMessage = await generateInitialMessage(call_goal, recipient_name, originalContext);
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="pt-BR">${initialMessage}</Say>
  <Gather input="speech" action="${Deno.env.get('SUPABASE_URL')}/functions/v1/twiml-gather?callId=${callId}" method="POST" speechTimeout="3" timeout="10" language="pt-BR">
    <Say voice="alice" language="pt-BR">Por favor, me diga se você pode me ajudar com isso.</Say>
  </Gather>
  <Say voice="alice" language="pt-BR">Não consegui ouvir uma resposta. Obrigado pelo seu tempo e tenha um ótimo dia!</Say>
  <Hangup/>
</Response>`;
}

async function generateInitialMessage(callGoal: string, recipientName: string, additionalContext: string): Promise<string> {
  // Use AI to generate a more natural and contextual opening message
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