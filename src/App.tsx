import React, { useState, useEffect } from 'react';
import { Bot, Phone, Sparkles } from 'lucide-react';
import CallForm from './components/CallForm';
import CallStatus from './components/CallStatus';
import CallHistory from './components/CallHistory';
import { CallRequest, CallRecord } from './types';
import { initiateCall, getCallStatus, simulateCallProgress } from './utils/mockApi';

type AppView = 'form' | 'status' | 'history';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('form');
  const [currentCall, setCurrentCall] = useState<CallRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [callHistoryRefresh, setCallHistoryRefresh] = useState(0);

  // Poll for call status updates when a call is active
  useEffect(() => {
    if (!currentCall || currentCall.status === 'completed' || currentCall.status === 'failed') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await getCallStatus(currentCall.id);
        if (response.success && response.data) {
          setCurrentCall(response.data);
        }
      } catch (error) {
        console.error('Failed to get call status:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentCall]);

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
          
          // Start the mock call progression
          simulateCallProgress(response.data);
        }
      }
    } catch (error) {
      console.error('Failed to initiate call:', error);
      // TODO: Show error message to user
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallComplete = () => {
    setCurrentCall(null);
    setCurrentView('form');
    setCallHistoryRefresh(prev => prev + 1);
  };

  const handleViewChange = (view: AppView) => {
    setCurrentView(view);
    if (view === 'form') {
      setCurrentCall(null);
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
            <CallStatus callRecord={currentCall} onComplete={handleCallComplete} />
          )}
          
          {currentView === 'history' && (
            <div className="w-full max-w-4xl">
              <CallHistory refreshTrigger={callHistoryRefresh} />
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
              <span className="text-blue-600 font-semibold"> Ready to integrate with real APIs.</span>
            </p>
            <div className="flex justify-center items-center space-x-6 mt-4 text-sm text-gray-500">
              <span>• Twilio Integration Ready</span>
              <span>• ElevenLabs Voice Synthesis</span>
              <span>• OpenAI/Claude Intelligence</span>
              <span>• Supabase Database</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;