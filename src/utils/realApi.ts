import { CallRequest, CallRecord, ApiResponse } from '../types';

// Real API implementation to replace mockApi.ts
export async function initiateCall(request: CallRequest): Promise<ApiResponse<string>> {
  try {
    // First, create call record in Supabase
    const callRecord = await createCallRecord(request);
    
    if (!callRecord.success || !callRecord.data) {
      return { success: false, error: 'Failed to create call record' };
    }

    // Then initiate Twilio call
    const twilioResponse = await fetch('/api/twilio/initiate-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callId: callRecord.data.id,
        phoneNumber: request.phoneNumber,
        recipientName: request.recipientName,
        callGoal: request.callGoal,
        additionalContext: request.additionalContext
      })
    });

    if (!twilioResponse.ok) {
      return { success: false, error: 'Failed to initiate call' };
    }

    const result = await twilioResponse.json();
    
    return {
      success: true,
      data: callRecord.data.id
    };

  } catch (error) {
    console.error('Call initiation error:', error);
    return { success: false, error: 'Failed to initiate call' };
  }
}

async function createCallRecord(request: CallRequest): Promise<ApiResponse<CallRecord>> {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/call_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        recipient_name: request.recipientName,
        phone_number: request.phoneNumber,
        call_goal: request.callGoal,
        additional_context: request.additionalContext,
        status: 'preparing'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create call record');
    }

    const data = await response.json();
    return { success: true, data: data[0] };

  } catch (error) {
    console.error('Create call record error:', error);
    return { success: false, error: 'Failed to create call record' };
  }
}

export async function getCallStatus(callId: string): Promise<ApiResponse<CallRecord>> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/call_records?id=eq.${callId}&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get call status');
    }

    const data = await response.json();
    
    if (data.length === 0) {
      return { success: false, error: 'Call not found' };
    }

    return { success: true, data: data[0] };

  } catch (error) {
    console.error('Get call status error:', error);
    return { success: false, error: 'Failed to get call status' };
  }
}

export async function getAllCalls(): Promise<ApiResponse<CallRecord[]>> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/call_records?select=*&order=created_at.desc`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get calls');
    }

    const data = await response.json();
    return { success: true, data };

  } catch (error) {
    console.error('Get all calls error:', error);
    return { success: false, error: 'Failed to get calls' };
  }
}