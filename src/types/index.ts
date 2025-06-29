export interface CallRequest {
  recipientName: string;
  phoneNumber: string;
  callGoal: string;
  additionalContext: string;
}

export interface CallRecord {
  id: string;
  recipientName: string;
  phoneNumber: string;
  callGoal: string;
  additionalContext: string;
  status: CallStatus;
  result: CallResult | null;
  createdAt: string;
  completedAt: string | null;
  duration: number; // in seconds
  conversationHistory?: ConversationTurn[];
  aiProvider?: string;
  voiceProvider?: string;
  errorLogs?: ErrorLog[];
}

export type CallStatus = 
  | 'idle' 
  | 'preparing' 
  | 'dialing' 
  | 'in-progress' 
  | 'completed' 
  | 'failed';

export interface CallResult {
  success: boolean;
  message: string;
  details?: string;
  transcript?: string;
  aiSummary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  objectives_achieved?: string[];
}

export interface ConversationTurn {
  timestamp: string;
  speaker: 'ai' | 'human';
  text: string;
  confidence?: number;
  emotion?: string;
  intent?: string;
}

export interface ErrorLog {
  timestamp: string;
  type: 'network' | 'api' | 'voice' | 'ai' | 'timeout' | 'unknown';
  message: string;
  details?: string;
  recovered: boolean;
  recovery_action?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorType?: string;
  retryable?: boolean;
}

export interface AIConfig {
  provider: 'openai' | 'claude';
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface VoiceConfig {
  provider: 'elevenlabs';
  voiceId: string;
  language: string;
  speed: number;
  pitch: number;
  clarity: string;
}

export interface ConversationContext {
  callGoal: string;
  recipientName: string;
  additionalContext: string;
  conversationHistory: ConversationTurn[];
  currentIntent?: string;
  extractedInfo?: Record<string, any>;
}