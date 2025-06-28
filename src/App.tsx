import React, { useState, useEffect, useRef } from 'react';
import { Bot, Phone, Sparkles, Bug } from 'lucide-react';
import CallForm from './components/CallForm';
import CallStatus from './components/CallStatus';
import CallHistory from './components/CallHistory';
import DebugPanel from './components/DebugPanel';
import { CallRequest, CallRecord } from './types';
import { initiateCall, getCallStatus } from './utils/realApi';

type AppView = 'form' | 'status' | 'history' | 'debug';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('form');
  const [currentCall, setCurrentCall] = useState<CallRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [callHistoryRefresh, setCallHistoryRefresh] = useState(0);
  
  // Use refs to avoid dependency issues
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentCallRef = useRef<CallRecord | null>(null);
  const currentViewRef = useRef<AppView>('form');

  // Update refs when state changes
  useEffect(() => {
    currentCallRef.current = currentCall;
  }, [currentCall]);

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  // Polling function
  const startPolling = (callId: string) => {
    // Clear any existing polling
    stopPolling();

    console.log('Starting polling for call:', callId);

    const poll = async () => {
      try {
        // Check if we should still be polling
        const call = currentCallRef.current;
        const view = currentViewRef.current;
        
        if (!call || view !== 'status' || call.status === 'completed' || call.status === 'failed') {
          console.log('Stopping polling - conditions not met');
          stopPolling();
          return;
        }

        const response = await getCallStatus(callId);
        if (response.success && response.data) {
          setCurrentCall(response.data);
          
          // Stop polling if call is completed or failed
          if (response.data.status === 'completed' || response.data.status === 'failed') {
            console.log('Call finished, stopping polling');
            stopPolling();
          }
        } else {
          console.error('Failed to get call status:', response.error);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Start polling every 3 seconds
    pollingIntervalRef.current = setInterval(poll, 3000);

    // Set timeout to stop polling after 5 minutes
    timeoutRef.current = setTimeout(() => {
      console.log('Polling timeout reached');
      stopPolling();
      
      // Mark call as failed if still in progress
      const call = currentCallRef.current;
      if (call && call.status !== 'completed' && call.status !== 'failed') {
        setCurrentCall(prev => prev ? {
          ...prev,
          status: 'failed',
          result: {
            success: false,
            message: 'Call timeout',
            details: 'Call monitoring timed out after 5 minutes'
          }
        } : null);
      }
    }, 300000); // 5 minutes
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const handleCallSubmit = async (request: CallRequest) => {
    setIsLoading(true);
    
    try {
      // Initiate the call
      const response = await initiateCall(request);
      
      if (response.success && response.data) {
        // Get initial call record
        const statusResponse = await getCallStatus(response.data);
        
        if (statusResponse.success && statusResponse.data) {
          setCurrentCall(statusResponse.data);
          setCurrentView('status');
          
          // Start polling for this call
          startPolling(response.data);
        } else {
          alert(statusResponse.error || 'Failed to get call status');
        }
      } else {
        // Show error to user
        alert(response.error || 'Failed to initiate call');
      }
    } catch (error) {
      console.error('Failed to initiate call:', error);
      alert('Failed to initiate call. Please check your configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallComplete = () => {
    stopPolling();
    setCurrentCall(null);
    setCurrentView('form');
    setCallHistoryRefresh(prev => prev + 1);
  };

  const handleViewChange = (view: AppView) => {
    // Stop polling when switching away from status view
    if (view !== 'status') {
      stopPolling();
    }
    
    setCurrentView(view);
    
    if (view === 'form') {
      setCurrentCall(null);
    }
    
    // If switching back to status view and we have an active call, restart polling
    if (view === 'status' && currentCall && currentCall.status !== 'completed' && currentCall.status !== 'failed') {
      startPolling(currentCall.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI Call Assistant</h1>
                <p className="text-sm text-gray-600">Professional AI-powered calling</p>
              </div>
            </div>

            <nav className="flex space-x-4">
              <button
                onClick={() => handleViewChange('form')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'form'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Phone className="w-4 h-4 inline mr-2" />
                New Call
              </button>
              <button
                onClick={() => handleViewChange('history')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'history'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                History
              </button>
              <button
                onClick={() => handleViewChange('debug')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'debug'
                    ? 'bg-red-100 text-red-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Bug className="w-4 h-4 inline mr-2" />
                Debug
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section - only show on form view */}
        {currentView === 'form' && !currentCall && (
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-6">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Your AI-Powered
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Call Assistant</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Let our advanced AI handle your phone calls with natural conversation, 
              professional tone, and reliable results. From appointments to inquiries, 
              we've got you covered.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Phone className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Natural Conversations</h3>
                <p className="text-gray-600 text-sm">AI that speaks naturally and handles complex conversations with ease</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Bot className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">24/7 Availability</h3>
                <p className="text-gray-600 text-sm">Make calls anytime, anywhere. Your AI assistant never sleeps</p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Smart Results</h3>
                <p className="text-gray-600 text-sm">Get detailed summaries and actionable outcomes from every call</p>
              </div>
            </div>
          </div>
        )}

        {/* Content Based on Current View */}
        <div className="flex justify-center">
          {currentView === 'form' && (
            <CallForm onSubmit={handleCallSubmit} isLoading={isLoading} />
          )}
          
          {currentView === 'status' && currentCall && (
            <div className="w-full max-w-2xl">
              <CallStatus callRecord={currentCall} onComplete={handleCallComplete} />
              
              {/* Debug info for call status */}
              <div className="mt-4 p-4 bg-gray-100 rounded-lg text-sm">
                <h4 className="font-medium mb-2">Debug Info:</h4>
                <p>Polling: {pollingIntervalRef.current ? 'Active' : 'Inactive'}</p>
                <p>Call ID: {currentCall.id}</p>
                <p>Status: {currentCall.status}</p>
                <p>Created: {new Date(currentCall.createdAt).toLocaleString()}</p>
                {currentCall.completedAt && (
                  <p>Completed: {new Date(currentCall.completedAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          )}
          
          {currentView === 'history' && (
            <div className="w-full max-w-4xl">
              <CallHistory refreshTrigger={callHistoryRefresh} />
            </div>
          )}

          {currentView === 'debug' && (
            <div className="w-full max-w-6xl">
              <DebugPanel />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-600">
              Built with modern AI technology. 
              <span className="text-blue-600 font-semibold"> Ready for production use.</span>
            </p>
            <div className="flex justify-center items-center space-x-6 mt-4 text-sm text-gray-500">
              <span>• Twilio Integration Active</span>
              <span>• Supabase Database Connected</span>
              <span>• Real-time Call Tracking</span>
              <span>• Production Ready</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;