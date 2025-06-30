import React, { useState, useEffect } from 'react';
import { Bot, Phone, Sparkles, Bug, AlertCircle, TestTube, Activity } from 'lucide-react';
import CallForm from './components/CallForm';
import CallStatus from './components/CallStatus';
import CallHistory from './components/CallHistory';
import DebugPanel from './components/DebugPanel';
import WebhookTester from './components/WebhookTester';
import DiagnosticTool from './components/DiagnosticTool';
import { CallRequest, CallRecord } from './types';
import { initiateCall, getCallStatus } from './utils/realApi';
import { supabase } from './lib/supabase';

type AppView = 'form' | 'status' | 'history' | 'debug' | 'webhooks' | 'diagnostics';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('form');
  const [currentCall, setCurrentCall] = useState<CallRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [callHistoryRefresh, setCallHistoryRefresh] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Check Supabase connection on mount
  useEffect(() => {
    checkDatabaseConnection();
  }, []);

  const checkDatabaseConnection = async () => {
    try {
      const { error } = await supabase.from('call_records').select('count').limit(1);
      if (error) {
        console.error('Database connection error:', error);
        setConnectionError(`Database connection failed: ${error.message}`);
      } else {
        setConnectionError(null);
      }
    } catch (error) {
      console.error('Failed to check database connection:', error);
      setConnectionError('Unable to connect to database. Please check your Supabase configuration.');
    }
  };

  const handleCallSubmit = async (request: CallRequest) => {
    setIsLoading(true);
    
    try {
      console.log('Initiating call with request:', request);
      
      // Initiate the call
      const response = await initiateCall(request);
      
      if (response.success && response.data) {
        console.log('Call initiated successfully, getting initial status...');
        
        // Get initial call record
        const statusResponse = await getCallStatus(response.data);
        
        if (statusResponse.success && statusResponse.data) {
          console.log('Got initial call status:', statusResponse.data.status);
          setCurrentCall(statusResponse.data);
          setCurrentView('status');
        } else {
          console.error('Failed to get call status:', statusResponse.error);
          alert(statusResponse.error || 'Failed to get call status');
        }
      } else {
        console.error('Failed to initiate call:', response.error);
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
    console.log('Call completed, returning to form view');
    setCurrentCall(null);
    setCurrentView('form');
    setCallHistoryRefresh(prev => prev + 1);
  };

  const handleViewChange = (view: AppView) => {
    console.log('Changing view to:', view);
    setCurrentView(view);
    if (view === 'form') {
      setCurrentCall(null);
    }
  };

  const refreshCallStatus = async () => {
    if (currentCall && currentCall.status !== 'completed' && currentCall.status !== 'failed') {
      try {
        console.log('Refreshing call status for:', currentCall.id);
        const response = await getCallStatus(currentCall.id);
        if (response.success && response.data) {
          console.log('Refreshed call status:', response.data.status);
          setCurrentCall(response.data);
        }
      } catch (error) {
        console.error('Failed to refresh call status:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Connection Error Banner */}
      {connectionError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-800 text-sm font-medium">Database Connection Issue</p>
              <p className="text-red-700 text-sm">{connectionError}</p>
            </div>
            <button
              onClick={checkDatabaseConnection}
              className="ml-4 px-3 py-1 bg-red-100 text-red-800 text-sm rounded hover:bg-red-200 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

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
                onClick={() => handleViewChange('diagnostics')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'diagnostics'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                Diagnostics
              </button>
              <button
                onClick={() => handleViewChange('webhooks')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === 'webhooks'
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <TestTube className="w-4 h-4 inline mr-2" />
                Test Webhooks
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
              <CallStatus 
                callRecord={currentCall} 
                onComplete={handleCallComplete}
                onRefresh={refreshCallStatus}
              />
            </div>
          )}
          
          {currentView === 'history' && (
            <div className="w-full max-w-4xl">
              <CallHistory refreshTrigger={callHistoryRefresh} />
            </div>
          )}

          {currentView === 'diagnostics' && (
            <div className="w-full max-w-6xl">
              <DiagnosticTool />
            </div>
          )}

          {currentView === 'webhooks' && (
            <div className="w-full max-w-6xl">
              <WebhookTester />
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
              <span>• Twilio Integration {connectionError ? '❌' : '✅'}</span>
              <span>• Supabase Database {connectionError ? '❌' : '✅'}</span>
              <span>• Real-time Call Tracking ✅</span>
              <span>• Production Ready ✅</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;