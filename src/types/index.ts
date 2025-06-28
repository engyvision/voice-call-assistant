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
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}