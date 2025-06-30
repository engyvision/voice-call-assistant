import React, { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';

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

  const runDiagnostics = async () => {
    setTesting(true);
    setResults([]);

    const tests = [
      testEnvironmentVariables,
      testSupabaseConnection,
      testOpenAIAPI,
      testTelnyxConfiguration,
      testWebhookFunctions
    ];

    for (const test of tests) {
      try {
        const result = await test();
        setResults(prev => [...prev, result]);
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
      'VITE_TELNYX_API_KEY',
      'VITE_TELNYX_CONNECTION_ID',
      'VITE_TELNYX_PHONE_NUMBER',
      'VITE_OPENAI_API_KEY'
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
        status: 'error',
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
        const hasGPT4o = data.data.some((model: any) => model.id.includes('gpt-4o'));
        
        return {
          service: 'OpenAI API',
          status: 'success',
          message: 'OpenAI API connection successful',
          details: `Found ${data.data.length} models, GPT-4o available: ${hasGPT4o ? 'Yes' : 'No'}`
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

  const testTelnyxConfiguration = async (): Promise<DiagnosticResult> => {
    const apiKey = import.meta.env.VITE_TELNYX_API_KEY;
    const connectionId = import.meta.env.VITE_TELNYX_CONNECTION_ID;
    const phoneNumber = import.meta.env.VITE_TELNYX_PHONE_NUMBER;

    if (!apiKey || !connectionId || !phoneNumber) {
      return {
        service: 'Telnyx Configuration',
        status: 'error',
        message: 'Telnyx credentials incomplete',
        details: `Missing: ${[
          !apiKey && 'API Key',
          !connectionId && 'Connection ID', 
          !phoneNumber && 'Phone Number'
        ].filter(Boolean).join(', ')}`,
        fix: 'Add missing Telnyx credentials to your environment variables'
      };
    }

    try {
      // Test Telnyx API access
      const response = await fetch('https://api.telnyx.com/v2/phone_numbers', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const phoneNumbers = data.data || [];
        const hasConfiguredNumber = phoneNumbers.some((num: any) => num.phone_number === phoneNumber);
        
        return {
          service: 'Telnyx Configuration',
          status: hasConfiguredNumber ? 'success' : 'warning',
          message: 'Telnyx API connection successful',
          details: `Found ${phoneNumbers.length} phone numbers. Configured number ${hasConfiguredNumber ? 'found' : 'NOT FOUND'}: ${phoneNumber}`,
          fix: !hasConfiguredNumber ? 'Verify your phone number is correctly configured in Telnyx' : undefined
        };
      } else if (response.status === 401) {
        return {
          service: 'Telnyx Configuration',
          status: 'error',
          message: 'Telnyx authentication failed',
          details: 'Invalid API Key',
          fix: 'Verify your Telnyx API Key'
        };
      } else {
        return {
          service: 'Telnyx Configuration',
          status: 'error',
          message: `Telnyx API error: HTTP ${response.status}`,
          details: await response.text(),
          fix: 'Check Telnyx service status and your account permissions'
        };
      }
    } catch (error) {
      return {
        service: 'Telnyx Configuration',
        status: 'error',
        message: 'Telnyx API connection failed',
        details: error.message,
        fix: 'Check your internet connection and Telnyx service status'
      };
    }
  };

  const testWebhookFunctions = async (): Promise<DiagnosticResult> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const testCallId = `diagnostic-${Date.now()}`;
    
    const webhooks = [
      'telnyx-initiate',
      'telnyx-webhook'
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
        message: 'All Telnyx webhook functions are accessible',
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
            <div>VITE_TELNYX_API_KEY: {maskApiKey(import.meta.env.VITE_TELNYX_API_KEY)}</div>
            <div>VITE_TELNYX_CONNECTION_ID: {import.meta.env.VITE_TELNYX_CONNECTION_ID || 'Not set'}</div>
            <div>VITE_TELNYX_PHONE_NUMBER: {import.meta.env.VITE_TELNYX_PHONE_NUMBER || 'Not set'}</div>
            <div>VITE_OPENAI_API_KEY: {maskApiKey(import.meta.env.VITE_OPENAI_API_KEY)}</div>
            <div>VITE_AI_MODEL: {import.meta.env.VITE_AI_MODEL || 'gpt-4o'}</div>
            <div>VITE_TTS_ENGINE: {import.meta.env.VITE_TTS_ENGINE || 'aws.polly'}</div>
            <div>VITE_TTS_VOICE: {import.meta.env.VITE_TTS_VOICE || 'Joanna-Neural'}</div>
            <div>VITE_TRANSCRIPTION_MODEL: {import.meta.env.VITE_TRANSCRIPTION_MODEL || 'distil-whisper/distil-large-v2'}</div>
          </div>
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
          <p>• <strong>If Telnyx tests fail:</strong> Verify your Telnyx credentials and account status.</p>
          <p>• <strong>New Configuration:</strong> Using Telnyx + OpenAI GPT-4o + AWS Polly + Distil-Whisper</p>
        </div>
      </div>
    </div>
  );
}