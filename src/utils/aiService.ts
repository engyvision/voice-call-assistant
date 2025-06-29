import { ConversationContext, ConversationTurn, ErrorLog } from '../types';

export interface AIResponse {
  text: string;
  intent?: string;
  confidence: number;
  shouldContinue: boolean;
  extractedInfo?: Record<string, any>;
  nextAction?: 'gather_info' | 'confirm' | 'end_call' | 'clarify';
}

export class AIService {
  private apiKey: string;
  private provider: 'openai' | 'claude';
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor() {
    this.provider = (import.meta.env.VITE_AI_PROVIDER as 'openai' | 'claude') || 'openai';
    this.model = import.meta.env.VITE_AI_MODEL || 'gpt-4';
    this.temperature = parseFloat(import.meta.env.VITE_AI_TEMPERATURE) || 0.7;
    this.maxTokens = parseInt(import.meta.env.VITE_AI_MAX_TOKENS) || 150;
    
    if (this.provider === 'openai') {
      this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    } else {
      this.apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
    }

    if (!this.apiKey) {
      throw new Error(`Missing API key for ${this.provider}`);
    }
  }

  async generateResponse(
    context: ConversationContext,
    userInput: string,
    errorLogs: ErrorLog[] = []
  ): Promise<AIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const conversationHistory = this.formatConversationHistory(context.conversationHistory);
      
      if (this.provider === 'openai') {
        return await this.callOpenAI(systemPrompt, conversationHistory, userInput);
      } else {
        return await this.callClaude(systemPrompt, conversationHistory, userInput);
      }
    } catch (error) {
      console.error('AI Service error:', error);
      
      // Return fallback response
      return {
        text: "Desculpe, tive um problema técnico. Pode repetir o que disse?",
        confidence: 0.1,
        shouldContinue: true,
        nextAction: 'clarify'
      };
    }
  }

  private buildSystemPrompt(context: ConversationContext): string {
    return `Você é um assistente de IA profissional fazendo uma ligação telefônica em português brasileiro.

OBJETIVO DA LIGAÇÃO: ${context.callGoal}
NOME DO DESTINATÁRIO: ${context.recipientName}
CONTEXTO ADICIONAL: ${context.additionalContext}

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

FORMATO DE RESPOSTA:
- Responda apenas com o texto que deve ser falado
- Não inclua ações ou descrições entre parênteses
- Mantenha tom conversacional e natural

Lembre-se: Você está representando seu cliente, seja profissional e eficiente.`;
  }

  private formatConversationHistory(history: ConversationTurn[]): string {
    return history.map(turn => {
      const speaker = turn.speaker === 'ai' ? 'Assistente' : 'Pessoa';
      return `${speaker}: ${turn.text}`;
    }).join('\n');
  }

  private async callOpenAI(
    systemPrompt: string,
    conversationHistory: string,
    userInput: string
  ): Promise<AIResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Histórico da conversa:\n${conversationHistory}\n\nÚltima fala da pessoa: ${userInput}\n\nResponda naturalmente em português:` }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
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

    return {
      text: aiText,
      confidence: 0.9,
      shouldContinue: !this.shouldEndCall(aiText),
      intent: this.extractIntent(aiText),
      nextAction: this.determineNextAction(aiText)
    };
  }

  private async callClaude(
    systemPrompt: string,
    conversationHistory: string,
    userInput: string
  ): Promise<AIResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Histórico da conversa:\n${conversationHistory}\n\nÚltima fala da pessoa: ${userInput}\n\nResponda naturalmente em português:`
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

    return {
      text: aiText,
      confidence: 0.9,
      shouldContinue: !this.shouldEndCall(aiText),
      intent: this.extractIntent(aiText),
      nextAction: this.determineNextAction(aiText)
    };
  }

  private shouldEndCall(text: string): boolean {
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

  private extractIntent(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('agendar') || lowerText.includes('marcar')) return 'schedule';
    if (lowerText.includes('informação') || lowerText.includes('saber')) return 'information';
    if (lowerText.includes('confirmar')) return 'confirm';
    if (lowerText.includes('cancelar')) return 'cancel';
    if (lowerText.includes('reagendar')) return 'reschedule';
    
    return 'general';
  }

  private determineNextAction(text: string): 'gather_info' | 'confirm' | 'end_call' | 'clarify' {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('?')) return 'gather_info';
    if (lowerText.includes('confirmar') || lowerText.includes('certo')) return 'confirm';
    if (this.shouldEndCall(text)) return 'end_call';
    
    return 'clarify';
  }

  async summarizeCall(conversationHistory: ConversationTurn[], callGoal: string): Promise<string> {
    try {
      const conversation = this.formatConversationHistory(conversationHistory);
      
      const prompt = `Analise esta conversa telefônica e forneça um resumo conciso:

OBJETIVO: ${callGoal}

CONVERSA:
${conversation}

Forneça um resumo estruturado incluindo:
1. Resultado principal (sucesso/falha)
2. Informações obtidas
3. Próximos passos (se houver)
4. Observações importantes

Mantenha o resumo objetivo e profissional.`;

      if (this.provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 300
          })
        });

        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || 'Resumo não disponível';
      } else {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 300,
            temperature: 0.3,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        const data = await response.json();
        return data.content[0]?.text?.trim() || 'Resumo não disponível';
      }
    } catch (error) {
      console.error('Error summarizing call:', error);
      return 'Erro ao gerar resumo da ligação';
    }
  }
}