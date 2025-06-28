import { CallRequest, CallRecord, CallResult, CallStatus, ApiResponse } from '../types';

// Mock database for call records
let mockCallRecords: CallRecord[] = [
  {
    id: '1',
    recipientName: 'Dr. Smith',
    phoneNumber: '+1-555-0123',
    callGoal: 'Book appointment',
    additionalContext: 'Dental cleaning appointment, preferably next week',
    status: 'completed',
    result: {
      success: true,
      message: 'Appointment successfully booked',
      details: 'Appointment scheduled for Tuesday, March 19th at 2:00 PM',
      transcript: 'Assistant: Hello, I\'d like to book a dental cleaning appointment...'
    },
    createdAt: '2024-01-15T10:30:00Z',
    completedAt: '2024-01-15T10:33:45Z',
    duration: 225
  },
  {
    id: '2',
    recipientName: 'Pizza Palace',
    phoneNumber: '+1-555-0456',
    callGoal: 'Make reservation',
    additionalContext: 'Table for 4 people, Friday evening',
    status: 'failed',
    result: {
      success: false,
      message: 'Unable to complete reservation',
      details: 'Restaurant is fully booked for Friday evening',
      transcript: 'Assistant: I\'d like to make a reservation for 4 people...'
    },
    createdAt: '2024-01-14T16:20:00Z',
    completedAt: '2024-01-14T16:22:15Z',
    duration: 135
  }
];

// Mock API functions
export async function initiateCall(request: CallRequest): Promise<ApiResponse<string>> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate unique call ID
  const callId = Date.now().toString();
  
  // Create new call record
  const newCall: CallRecord = {
    id: callId,
    ...request,
    status: 'preparing',
    result: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    duration: 0
  };
  
  mockCallRecords.unshift(newCall);
  
  return {
    success: true,
    data: callId
  };
}

export async function getCallStatus(callId: string): Promise<ApiResponse<CallRecord>> {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const call = mockCallRecords.find(c => c.id === callId);
  if (!call) {
    return {
      success: false,
      error: 'Call not found'
    };
  }
  
  return {
    success: true,
    data: call
  };
}

export async function getAllCalls(): Promise<ApiResponse<CallRecord[]>> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return {
    success: true,
    data: [...mockCallRecords]
  };
}

// Simulate call progression
export function simulateCallProgress(callId: string): void {
  const updateCallStatus = (status: CallStatus, result?: CallResult) => {
    const callIndex = mockCallRecords.findIndex(c => c.id === callId);
    if (callIndex !== -1) {
      mockCallRecords[callIndex] = {
        ...mockCallRecords[callIndex],
        status,
        result: result || mockCallRecords[callIndex].result,
        completedAt: (status === 'completed' || status === 'failed') 
          ? new Date().toISOString() 
          : mockCallRecords[callIndex].completedAt,
        duration: (status === 'completed' || status === 'failed')
          ? Math.floor((Date.now() - new Date(mockCallRecords[callIndex].createdAt).getTime()) / 1000)
          : mockCallRecords[callIndex].duration
      };
    }
  };

  // Simulate call progression with realistic timing
  setTimeout(() => updateCallStatus('dialing'), 2000);
  setTimeout(() => updateCallStatus('in-progress'), 4000);
  
  // Simulate random success/failure after 8-15 seconds
  const duration = 8000 + Math.random() * 7000;
  setTimeout(() => {
    const success = Math.random() > 0.3; // 70% success rate
    const call = mockCallRecords.find(c => c.id === callId);
    
    if (call) {
      const result: CallResult = success 
        ? generateSuccessResult(call.callGoal)
        : generateFailureResult(call.callGoal);
      
      updateCallStatus(success ? 'completed' : 'failed', result);
    }
  }, duration);
}

function generateSuccessResult(callGoal: string): CallResult {
  const successMessages = {
    'Book appointment': [
      'Appointment successfully booked',
      'Your appointment has been confirmed',
      'Booking completed successfully'
    ],
    'Get information': [
      'Information successfully obtained',
      'All requested details have been gathered',
      'Information inquiry completed'
    ],
    'Make reservation': [
      'Reservation confirmed',
      'Your table has been reserved',
      'Reservation successfully made'
    ],
    'General inquiry': [
      'Inquiry completed successfully',
      'Information obtained as requested',
      'Call objective achieved'
    ]
  };

  const successDetails = {
    'Book appointment': [
      'Appointment scheduled for Tuesday, March 19th at 2:00 PM',
      'Your appointment is set for Friday at 10:30 AM',
      'Booked for next Monday at 3:15 PM'
    ],
    'Get information': [
      'Business hours: Monday-Friday 9AM-6PM, Saturday 10AM-4PM',
      'Current promotion: 20% off all services this month',
      'Location: 123 Main Street, downtown area'
    ],
    'Make reservation': [
      'Table for 4 reserved for Friday at 7:30 PM',
      'Your reservation is confirmed for Saturday at 6:00 PM',
      'Reserved table for 2 on Sunday evening at 8:00 PM'
    ],
    'General inquiry': [
      'All requested information has been provided',
      'Questions answered and details confirmed',
      'Inquiry resolved with full details'
    ]
  };

  const messageArray = successMessages[callGoal as keyof typeof successMessages] || successMessages['General inquiry'];
  const detailArray = successDetails[callGoal as keyof typeof successDetails] || successDetails['General inquiry'];
  
  return {
    success: true,
    message: messageArray[Math.floor(Math.random() * messageArray.length)],
    details: detailArray[Math.floor(Math.random() * detailArray.length)],
    transcript: 'Assistant: Hello, I\'m calling on behalf of my client...\nRecipient: Yes, how can I help you?\nAssistant: I\'d like to...'
  };
}

function generateFailureResult(callGoal: string): CallResult {
  const failureMessages = [
    'Unable to complete the call',
    'Call could not be completed as requested',
    'Objective not achieved during call',
    'Request could not be fulfilled'
  ];

  const failureReasons = [
    'No answer after multiple attempts',
    'Requested service is currently unavailable',
    'Additional information required from customer',
    'Business is closed or not taking requests',
    'Phone number appears to be disconnected',
    'Person was unavailable to complete the request'
  ];

  return {
    success: false,
    message: failureMessages[Math.floor(Math.random() * failureMessages.length)],
    details: failureReasons[Math.floor(Math.random() * failureReasons.length)],
    transcript: 'Assistant: Hello, I\'m calling on behalf of...\n[Call ended: No response]'
  };
}