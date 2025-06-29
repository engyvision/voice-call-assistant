import React, { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import ElevenLabsFixGuide from './ElevenLabsFixGuide';

interface DiagnosticResult {
  service: string;
  status: 'success' | 'warning' | 'error' | 'testing';
  message: string;
  details?: string;
  fix?: string;
}

export default function DiagnosticTool() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [testing, setTesting] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [showElevenLabsFix, setShowElevenLabsFix] = useState(false);

  const runDiagnostics = async () => {
    setTesting(true);
    setResults([]);

    const tests = [
      testEnvironmentVariables,
      testSupabaseConnection,
      testOpenAIAPI,
      testElevenLabsAPI,
      testWebhookFunctions,
      testTwilioConfiguration
    ];

    for (const test of tests) {
      try {
        const result = await test();
        setResults(prev => [...prev, result]);
        
        // Show ElevenLabs fix guide if ElevenLabs test fails
        if (result.service === 'ElevenLabs API' && result.status === 'error') {
          setShowElevenLabsFix(true);
        }
      } catch (error) {
        setResults(prev => [...prev, {
          service: 'Test Error',
          status: 'error',
          message: `Test failed: ${error.message}`,
          fix: 'Check console for detailed error information'
        }]);
      }
    }

    setTesting(false);
  };

  const testEnvironmentVariables = async (): Promise<DiagnosticResult> => {
    const requiredVars = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_TWILIO_ACCOUNT_SID',
      'VITE_TWILIO_AUTH_TOKEN',
      'VITE_TWILIO_PHONE_NUMBER',
      'VITE_OPENAI_API_KEY',
      'VITE_ELEVENLABS_API_KEY',
      'VITE_ELEVENLABS_VOICE_ID'
    ];

    const missing = requiredVars.filter(varName => !import.meta.env[varName]);
    
    if (missing.length === 0) {
      return {
        service: 'Environment Variables',
        status: 'success',
        message: 'All required environment variables are set',
        details: `Checked ${requiredVars.length} variables`
      };
    } else {
      return {
        service: 'Environment Variables',
        status: 'error',
        message: `Missing ${missing.length} required environment variables`,
        details: `Missing: ${missing.join(', ')}`,
        fix: 'Add missing variables to your .env file and restart the development server'
      };
    }
  };

  const testSupabaseConnection = async (): Promise<DiagnosticResult> => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/call_records?select=count`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        }
      });

      if (response.ok) {
        return {
          service: 'Supabase Database',
          status: 'success',
          message: 'Database connection successful',
          details: `Connected to ${import.meta.env.VITE_SUPABASE_URL}`
        };
      } else {
        return {
          service: 'Supabase Database',
          status: 'error',
          message: `Database connection failed: HTTP ${response.status}`,
          details: await response.text(),
          fix: 'Check your Supabase URL and API key'
        };
      }
    } catch (error) {
      return {
        service: 'Supabase Database',
        status: 'error',
        message: 'Database connection failed',
        details: error.message,
        fix: 'Verify your Supabase configuration and internet connection'
      };
    }
  };

  const testOpenAIAPI = async (): Promise<DiagnosticResult> => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      return {
        service: 'OpenAI API',
        status: 'warning',
        message: 'OpenAI API key not configured',
        fix: 'Add VITE_OPENAI_API_KEY to your environment variables'
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const hasGPT4 = data.data.some((model: any) => model.id.includes('gpt-4'));
        
        return {
          service: 'OpenAI API',
          status: 'success',
          message: 'OpenAI API connection successful',
          details: `Found ${data.data.length} models, GPT-4 available: ${hasGPT4 ? 'Yes' : 'No'}`
        };
      } else if (response.status === 401) {
        return {
          service: 'OpenAI API',
          status: 'error',
          message: 'OpenAI API authentication failed',
          details: 'Invalid API key',
          fix: 'Check your OpenAI API key and ensure it has sufficient credits'
        };
      } else {
        return {
          service: 'OpenAI API',
          status: 'error',
          message: `OpenAI API error: HTTP ${response.status}`,
          details: await response.text(),
          fix: 'Check OpenAI service status and your API key permissions'
        };
      }
    } catch (error) {
      return {
        service: 'OpenAI API',
        status: 'error',
        message: 'OpenAI API connection failed',
        details: error.message,
        fix: 'Check your internet connection and OpenAI service status'
      };
    }
  };

  const testElevenLabsAPI = async (): Promise<DiagnosticResult> => {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID;
    
    if (!apiKey) {
      return {
        service: 'ElevenLabs API',
        status: 'warning',
        message: 'ElevenLabs API key not configured',
        fix: 'Add VITE_ELEVENLABS_API_KEY to your environment variables'
      };
    }

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const voiceExists = voiceId ? data.voices.some((voice: any) => voice.voice_id === voiceId) : false;
        const portugueseVoices = data.voices.filter((voice: any) => 
          voice.labels?.language?.includes('Portuguese') || 
          voice.labels?.language?.includes('pt')
        );
        
        return {
          service: 'ElevenLabs API',
          status: voiceExists ? 'success' : 'warning',
          message: 'ElevenLabs API connection successful',
          details: `Found ${data.voices.length} voices, ${portugueseVoices.length} Portuguese voices. Configured voice ${voiceExists ? 'found' : 'NOT FOUND'}`,
          fix: !voiceExists ? 'Update VITE_ELEVENLABS_VOICE_ID with a valid Portuguese voice ID' : undefined
        };
      } else if (response.status === 401) {
        return {
          service: 'ElevenLabs API',
          status: 'error',
          message: 'ElevenLabs API authentication failed',
          details: 'Invalid API key',
          fix: 'Check your ElevenLabs API key and ensure you have sufficient credits'
        };
      } else {
        return {
          service: 'ElevenLabs API',
          status: 'error',
          message: `ElevenLabs API error: HTTP ${response.status}`,
          details: await response.text(),
          fix: 'Check ElevenLabs service status and your API key permissions'
        };
      }
    } catch (error) {
      return {
        service: 'ElevenLabs API',
        status: 'error',
        message: 'ElevenLabs API connection failed',
        details: error.message,
        fix: 'Check your internet connection and ElevenLabs service status'
      };
    }
  };

  const testWebhookFunctions = async (): Promise<DiagnosticResult> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const testCallId = `diagnostic-${Date.now()}`;
    
    const webhooks = [
      'twiml-voice',
      'twiml-status',
      'twiml-gather',
      'twilio-initiate'
    ];

    const results = [];
    
    for (const webhook of webhooks) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${webhook}?callId=${testCallId}`, {
          method: 'GET'
        });
        
        results.push({
          webhook,
          status: response.status,
          accessible: response.status !== 404
        });
      } catch (error) {
        results.push({
          webhook,
          status: 'error',
          accessible: false,
          error: error.message
        });
      }
    }

    const accessibleCount = results.filter(r => r.accessible).length;
    const totalCount = results.length;

    if (accessibleCount === totalCount) {
      return {
        service: 'Webhook Functions',
        status: 'success',
        message: 'All webhook functions are accessible',
        details: `${accessibleCount}/${totalCount} functions responding`
      };
    } else {
      const inaccessible = results.filter(r => !r.accessible).map(r => r.webhook);
      return {
        service: 'Webhook Functions',
        status: 'error',
        message: `${totalCount - accessibleCount} webhook functions not accessible`,
        details: `Not accessible: ${inaccessible.join(', ')}`,
        fix: 'Deploy missing Edge Functions to Supabase and ensure environment variables are set'
      };
    }
  };

  const testTwilioConfiguration = async (): Promise<DiagnosticResult> => {
    const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
    const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
    const phoneNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !phoneNumber) {
      return {
        service: 'Twilio Configuration',
        status: 'error',
        message: 'Twilio credentials incomplete',
        details: `Missing: ${[
          !accountSid && 'Account SID',
          !authToken && 'Auth Token', 
          !phoneNumber && 'Phone Number'
        ].filter(Boolean).join(', ')}`,
        fix: 'Add missing Twilio credentials to your environment variables'
      };
    }

    try {
      // Test Twilio API access
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          service: 'Twilio Configuration',
          status: 'success',
          message: 'Twilio API connection successful',
          details: `Account: ${data.friendly_name}, Status: ${data.status}`
        };
      } else if (response.status === 401) {
        return {
          service: 'Twilio Configuration',
          status: 'error',
          message: 'Twilio authentication failed',
          details: 'Invalid Account SID or Auth Token',
          fix: 'Verify your Twilio Account SID and Auth Token'
        };
      } else {
        return {
          service: 'Twilio Configuration',
          status: 'error',
          message: `Twilio API error: HTTP ${response.status}`,
          details: await response.text(),
          fix: 'Check Twilio service status and your account permissions'
        };
      }
    } catch (error) {
      return {
        service: 'Twilio Configuration',
        status: 'error',
        message: 'Twilio API connection failed',
        details: error.message,
        fix: 'Check your internet connection and Twilio service status'
      };
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'testing':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'testing':
        return 'border-blue-200 bg-blue-50';
    }
  };

  const maskApiKey = (key: string) => {
    if (!key) return 'Not set';
    if (key.length <= 8) return '***';
    return key.substring(0, 4) + '***' + key.substring(key.length - 4);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Activity className="w-6 h-6 text-blue-600 mr-3" />
          <h2 className="text-2xl font-bold text-gray-900">System Diagnostics</h2>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setShowApiKeys(!showApiKeys)}
            className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            {showApiKeys ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            {showApiKeys ? 'Hide' : 'Show'} API Keys
          </button>
          
          <button
            onClick={runDiagnostics}
            disabled={testing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Activity className="w-4 h-4 mr-2" />
            )}
            {testing ? 'Running Diagnostics...' : 'Run Full Diagnostics'}
          </button>
        </div>
      </div>

      {/* Environment Variables Display */}
      {showApiKeys && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-gray-900 mb-3">Environment Variables</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-mono">
            <div>VITE_SUPABASE_URL: {maskApiKey(import.meta.env.VITE_SUPABASE_URL)}</div>
            <div>VITE_SUPABASE_ANON_KEY: {maskApiKey(import.meta.env.VITE_SUPABASE_ANON_KEY)}</div>
            <div>VITE_TWILIO_ACCOUNT_SID: {maskApiKey(import.meta.env.VITE_TWILIO_ACCOUNT_SID)}</div>
            <div>VITE_TWILIO_AUTH_TOKEN: {maskApiKey(import.meta.env.VITE_TWILIO_AUTH_TOKEN)}</div>
            <div>VITE_TWILIO_PHONE_NUMBER: {import.meta.env.VITE_TWILIO_PHONE_NUMBER || 'Not set'}</div>
            <div>VITE_OPENAI_API_KEY: {maskApiKey(import.meta.env.VITE_OPENAI_API_KEY)}</div>
            <div>VITE_ELEVENLABS_API_KEY: {maskApiKey(import.meta.env.VITE_ELEVENLABS_API_KEY)}</div>
            <div>VITE_ELEVENLABS_VOICE_ID: {import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'Not set'}</div>
          </div>
        </div>
      )}

      {/* ElevenLabs Fix Guide */}
      {showElevenLabsFix && (
        <div className="mb-6">
          <ElevenLabsFixGuide />
        </div>
      )}

      {/* Diagnostic Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Diagnostic Results</h3>
          
          {results.map((result, index) => (
            <div key={index} className={`border rounded-lg p-4 ${getStatusColor(result.status)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {getStatusIcon(result.status)}
                  <span className="ml-2 font-medium">{result.service}</span>
                </div>
                <span className="text-sm text-gray-600 capitalize">{result.status}</span>
              </div>
              
              <div className="text-sm text-gray-700 mb-2">{result.message}</div>
              
              {result.details && (
                <div className="text-xs text-gray-600 bg-white bg-opacity-50 p-2 rounded mb-2">
                  <strong>Details:</strong> {result.details}
                </div>
              )}
              
              {result.fix && (
                <div className="text-xs text-blue-800 bg-blue-100 p-2 rounded">
                  <strong>Fix:</strong> {result.fix}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-3">Quick Actions</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>• <strong>If all tests pass:</strong> Your system should be working. Try making a test call.</p>
          <p>• <strong>If API tests fail:</strong> Check your API keys and service status pages.</p>
          <p>• <strong>If webhook tests fail:</strong> Ensure Edge Functions are deployed with environment variables.</p>
          <p>• <strong>If Twilio tests fail:</strong> Verify your Twilio credentials and account status.</p>
          <p>• <strong>If ElevenLabs fails with "Failed to fetch":</strong> This is normal from browser. Check Edge Function environment variables.</p>
        </div>
      </div>
    </div>
  );
}