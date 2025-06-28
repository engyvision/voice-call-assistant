import React, { useEffect, useState } from 'react';
import { Phone, Clock, CheckCircle, XCircle, PhoneCall, Loader2 } from 'lucide-react';
import { CallRecord, CallStatus as CallStatusType } from '../types';

interface CallStatusProps {
  callRecord: CallRecord;
  onComplete: () => void;
}

const statusConfig = {
  preparing: {
    icon: Loader2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    message: 'Preparing your call...',
    description: 'Setting up AI assistant and validating request'
  },
  dialing: {
    icon: Phone,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    message: 'Dialing...',
    description: 'Connecting to recipient'
  },
  'in-progress': {
    icon: PhoneCall,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    message: 'Call in progress',
    description: 'AI assistant is speaking with recipient'
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    message: 'Call completed',
    description: 'Call finished successfully'
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    message: 'Call failed',
    description: 'Unable to complete the call'
  }
};

export default function CallStatus({ callRecord, onComplete }: CallStatusProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (callRecord.status === 'completed' || callRecord.status === 'failed') {
      if (!isCompleted) {
        setIsCompleted(true);
        setTimeout(onComplete, 2000); // Auto-advance after 2 seconds
      }
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const start = new Date(callRecord.createdAt).getTime();
      setElapsedTime(Math.floor((now - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [callRecord.status, callRecord.createdAt, onComplete, isCompleted]);

  const config = statusConfig[callRecord.status];
  const IconComponent = config.icon;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl mx-auto">
      <div className="text-center">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${config.bgColor}`}>
          <IconComponent 
            className={`w-10 h-10 ${config.color} ${
              callRecord.status === 'preparing' || callRecord.status === 'dialing' ? 'animate-spin' : ''
            }`} 
          />
        </div>

        <h2 className="text-3xl font-bold text-gray-900 mb-2">{config.message}</h2>
        <p className="text-gray-600 mb-6">{config.description}</p>

        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Calling:</span>
              <p className="font-semibold text-gray-900">{callRecord.recipientName}</p>
            </div>
            <div>
              <span className="text-gray-500">Number:</span>
              <p className="font-semibold text-gray-900">{callRecord.phoneNumber}</p>
            </div>
            <div>
              <span className="text-gray-500">Goal:</span>
              <p className="font-semibold text-gray-900">{callRecord.callGoal}</p>
            </div>
            <div>
              <span className="text-gray-500">Duration:</span>
              <p className="font-semibold text-gray-900">
                <Clock className="inline w-4 h-4 mr-1" />
                {formatTime(callRecord.status === 'completed' || callRecord.status === 'failed' 
                  ? callRecord.duration 
                  : elapsedTime)}
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar for active calls */}
        {callRecord.status !== 'completed' && callRecord.status !== 'failed' && (
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${
                  callRecord.status === 'preparing' ? 'bg-blue-600 w-1/4' :
                  callRecord.status === 'dialing' ? 'bg-yellow-600 w-1/2' :
                  callRecord.status === 'in-progress' ? 'bg-green-600 w-3/4' :
                  'w-full'
                }`}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Preparing</span>
              <span>Dialing</span>
              <span>In Progress</span>
              <span>Complete</span>
            </div>
          </div>
        )}

        {/* Results section for completed/failed calls */}
        {(callRecord.status === 'completed' || callRecord.status === 'failed') && callRecord.result && (
          <div className={`rounded-xl p-6 ${
            callRecord.result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className={`flex items-center justify-center mb-4 ${
              callRecord.result.success ? 'text-green-600' : 'text-red-600'
            }`}>
              {callRecord.result.success ? (
                <CheckCircle className="w-8 h-8 mr-2" />
              ) : (
                <XCircle className="w-8 h-8 mr-2" />
              )}
              <h3 className="text-xl font-bold">{callRecord.result.message}</h3>
            </div>
            
            {callRecord.result.details && (
              <p className={`text-lg mb-4 ${
                callRecord.result.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {callRecord.result.details}
              </p>
            )}

            {callRecord.result.transcript && (
              <div className="text-left">
                <h4 className="font-semibold text-gray-700 mb-2">Call Summary:</h4>
                <div className="bg-white p-4 rounded-lg border text-sm text-gray-600 font-mono whitespace-pre-line">
                  {callRecord.result.transcript}
                </div>
              </div>
            )}
          </div>
        )}

        {(callRecord.status === 'completed' || callRecord.status === 'failed') && (
          <button
            onClick={onComplete}
            className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Make Another Call
          </button>
        )}
      </div>
    </div>
  );
}