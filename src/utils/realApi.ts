import { CallRequest, CallRecord, ApiResponse } from '../types';
import { supabase } from '../lib/supabase';

// Add connection health check
let connectionHealthy = false;
let lastHealthCheck = 0;

async function checkSupabaseConnection(): Promise<boolean> {
  const now = Date.now();
  
  // Only check every 30 seconds to avoid excessive requests
  if (connectionHealthy && (now - lastHealthCheck) < 30000) {
    return true;
  }

  try {
    const { error } = await supabase.from('call_records').select('count').limit(1);
    connectionHealthy = !error;
    lastHealthCheck = now;
    
    if (error) {
      console.warn('Supabase connection issue:', error.message);
    }
    
    return connectionHealthy;
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    connectionHealthy = false;
    return false;
  }
}

// Enhanced real-time subscription for call updates with better error handling
export function subscribeToCallUpdates(callId: string, callback: (callRecord: CallRecord) => void) {
  console.log('Setting up real-time subscription for call:', callId);
  
  const subscription = supabase
    .channel(`call-updates-${callId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'call_records',
        filter: `id=eq.${callId}`
      },
      async (payload) => {
        console.log('Real-time call update received:', {
          event: payload.eventType,
          table: payload.table,
          new: payload.new ? {
            id: payload.new.id,
            status: payload.new.status,
            transcriptLength: payload.new.result_transcript?.length || 0
          } : null
        });
        
        try {
          // Transform the updated record
          const data = payload.new;
          const callRecord: CallRecord = {
            id: data.id,
            recipientName: data.recipient_name,
            phoneNumber: data.phone_number,
            callGoal: data.call_goal,
            additionalContext: data.additional_context || '',
            status: data.status,
            result: data.result_success !== null ? {
              success: data.result_success,
              message: data.result_message || '',
              details: data.result_details || '',
              transcript: data.result_transcript || ''
            } : null,
            createdAt: data.created_at,
            completedAt: data.completed_at,
            duration: data.duration || 0
          };
          
          console.log('Transformed call record for real-time update:', {
            id: callRecord.id,
            status: callRecord.status,
            transcriptLength: callRecord.result?.transcript?.length || 0,
            hasResult: !!callRecord.result
          });
          
          callback(callRecord);
        } catch (error) {
          console.error('Error processing real-time update:', error);
        }
      }
    )
    .on('system', {}, (status) => {
      console.log('Real-time subscription system status:', status);
    })
    .subscribe((status) => {
      console.log('Subscription status changed:', status);
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to real-time updates for call:', callId);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Real-time subscription error for call:', callId);
      } else if (status === 'TIMED_OUT') {
        console.warn('Real-time subscription timed out for call:', callId);
      } else if (status === 'CLOSED') {
        console.log('Real-time subscription closed for call:', callId);
      }
    });

  return subscription;
}

// Real API implementation to replace mockApi.ts
export async function initiateCall(request: CallRequest): Promise<ApiResponse<string>> {
  try {
    // Check connection health first
    const isHealthy = await checkSupabaseConnection();
    if (!isHealthy) {
      return { success: false, error: 'Database connection unavailable. Please check your Supabase configuration.' };
    }

    // First, create call record in Supabase
    const { data: callRecord, error: createError } = await supabase
      .from('call_records')
      .insert({
        recipient_name: request.recipientName,
        phone_number: request.phoneNumber,
        call_goal: request.callGoal,
        additional_context: request.additionalContext,
        status: 'preparing'
      })
      .select()
      .single();

    if (createError || !callRecord) {
      console.error('Failed to create call record:', createError);
      return { success: false, error: 'Failed to create call record' };
    }

    console.log('Created call record:', callRecord.id);

    // Then initiate Twilio call via edge function
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        callId: callRecord.id,
        phoneNumber: request.phoneNumber,
        recipientName: request.recipientName,
        callGoal: request.callGoal,
        additionalContext: request.additionalContext
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to initiate call:', errorText);
      
      // Update call record with error status
      await supabase
        .from('call_records')
        .update({ 
          status: 'failed',
          result_success: false,
          result_message: 'Failed to initiate call',
          result_details: errorText
        })
        .eq('id', callRecord.id);
      
      return { success: false, error: 'Failed to initiate call' };
    }

    const result = await response.json();
    
    if (!result.success) {
      // Update call record with error status
      await supabase
        .from('call_records')
        .update({ 
          status: 'failed',
          result_success: false,
          result_message: 'Call initiation failed',
          result_details: result.error || 'Unknown error'
        })
        .eq('id', callRecord.id);
      
      return { success: false, error: result.error || 'Failed to initiate call' };
    }

    console.log('Call initiated successfully:', result.twilioSid);

    // Set up a timeout to mark call as failed if it stays in dialing too long
    setTimeout(async () => {
      try {
        const { data: currentCall } = await supabase
          .from('call_records')
          .select('status')
          .eq('id', callRecord.id)
          .single();
        
        // If call is still in dialing or preparing state after 2 minutes, mark as failed
        if (currentCall && (currentCall.status === 'dialing' || currentCall.status === 'preparing')) {
          console.log('Call timeout - marking as failed:', callRecord.id);
          await supabase
            .from('call_records')
            .update({ 
              status: 'failed',
              result_success: false,
              result_message: 'Call timeout',
              result_details: 'The call did not connect within the expected timeframe. This could be due to network issues, invalid number, or the recipient not answering.',
              completed_at: new Date().toISOString()
            })
            .eq('id', callRecord.id);
        }
      } catch (error) {
        console.error('Error in call timeout handler:', error);
      }
    }, 120000); // 2 minutes timeout

    return {
      success: true,
      data: callRecord.id
    };

  } catch (error) {
    console.error('Call initiation error:', error);
    return { success: false, error: 'Failed to initiate call' };
  }
}

export async function getCallStatus(callId: string): Promise<ApiResponse<CallRecord>> {
  try {
    // Check connection health first
    const isHealthy = await checkSupabaseConnection();
    if (!isHealthy) {
      return { success: false, error: 'Database connection unavailable' };
    }

    console.log('Fetching call status for:', callId);

    const { data, error } = await supabase
      .from('call_records')
      .select('*')
      .eq('id', callId)
      .single();

    if (error) {
      console.error('Failed to get call status:', error);
      return { success: false, error: 'Failed to get call status' };
    }

    if (!data) {
      return { success: false, error: 'Call not found' };
    }

    console.log('Retrieved call status:', {
      id: data.id,
      status: data.status,
      transcriptLength: data.result_transcript?.length || 0,
      duration: data.duration
    });

    // Check if call has been in dialing state too long and mark as failed
    if (data.status === 'dialing' || data.status === 'preparing') {
      const createdAt = new Date(data.created_at).getTime();
      const now = Date.now();
      const timeDiff = now - createdAt;
      
      // If more than 2 minutes have passed, mark as failed
      if (timeDiff > 120000) {
        console.log('Call has been dialing too long, marking as failed:', callId);
        
        const { data: updatedData } = await supabase
          .from('call_records')
          .update({ 
            status: 'failed',
            result_success: false,
            result_message: 'Call timeout',
            result_details: 'The call did not connect within the expected timeframe.',
            completed_at: new Date().toISOString()
          })
          .eq('id', callId)
          .select()
          .single();
        
        if (updatedData) {
          data.status = updatedData.status;
          data.result_success = updatedData.result_success;
          data.result_message = updatedData.result_message;
          data.result_details = updatedData.result_details;
          data.completed_at = updatedData.completed_at;
        }
      }
    }

    // Transform database record to match CallRecord interface
    const callRecord: CallRecord = {
      id: data.id,
      recipientName: data.recipient_name,
      phoneNumber: data.phone_number,
      callGoal: data.call_goal,
      additionalContext: data.additional_context || '',
      status: data.status,
      result: data.result_success !== null ? {
        success: data.result_success,
        message: data.result_message || '',
        details: data.result_details || '',
        transcript: data.result_transcript || ''
      } : null,
      createdAt: data.created_at,
      completedAt: data.completed_at,
      duration: data.duration || 0
    };

    return { success: true, data: callRecord };

  } catch (error) {
    console.error('Get call status error:', error);
    return { success: false, error: 'Failed to get call status' };
  }
}

export async function getAllCalls(): Promise<ApiResponse<CallRecord[]>> {
  try {
    // Check connection health first
    const isHealthy = await checkSupabaseConnection();
    if (!isHealthy) {
      return { success: false, error: 'Database connection unavailable' };
    }

    const { data, error } = await supabase
      .from('call_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to get calls:', error);
      return { success: false, error: 'Failed to get calls' };
    }

    // Transform database records to match CallRecord interface
    const callRecords: CallRecord[] = data.map(record => ({
      id: record.id,
      recipientName: record.recipient_name,
      phoneNumber: record.phone_number,
      callGoal: record.call_goal,
      additionalContext: record.additional_context || '',
      status: record.status,
      result: record.result_success !== null ? {
        success: record.result_success,
        message: record.result_message || '',
        details: record.result_details || '',
        transcript: record.result_transcript || ''
      } : null,
      createdAt: record.created_at,
      completedAt: record.completed_at,
      duration: record.duration || 0
    }));

    return { success: true, data: callRecords };

  } catch (error) {
    console.error('Get all calls error:', error);
    return { success: false, error: 'Failed to get calls' };
  }
}

// Keep the mock simulation function for development/testing
export function simulateCallProgress(callId: string): void {
  // This function is no longer needed as real calls will update via webhooks
  console.log('Real call initiated, progress will be tracked via Twilio webhooks');
}