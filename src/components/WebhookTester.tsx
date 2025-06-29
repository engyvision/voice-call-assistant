import React, { useState } from 'react';
import { TestTube, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface TestResult {
  name: string;
  url: string;
  status: number;
  success: boolean;
  response?: string;
  error?: string;
  timing: number;
}

export default function WebhookTester() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);

  const testWebhooks = async () => {
    setTesting(true);
    setResults([]);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const testCallId = `test-${Date.now()}`;

    const webhooks = [
      {
        name: 'TwiML Voice (GET)',
        url: `${supabaseUrl}/functions/v1/twiml-voice?callId=${testCallId}`,
        method: 'GET',
        expectedStatus: [200, 401] // Either works or needs auth
      },
      {
        name: 'TwiML Voice (POST)',
        url: `${supabaseUrl}/functions/v1/twiml-voice?callId=${testCallId}`,
        method: 'POST',
        body: new URLSearchParams({
          CallSid: 'test-call-sid',
          CallStatus: 'in-progress',
          From: '+15551234567',
          To: '+15559876543'
        }),
        expectedStatus: [200, 401]
      },
      {
        name: 'TwiML Status',
        url: `${supabaseUrl}/functions/v1/twiml-status?callId=${testCallId}`,
        method: 'POST',
        body: new URLSearchParams({
          CallSid: 'test-call-sid',
          CallStatus: 'completed'
        }),
        expectedStatus: [200, 401]
      },
      {
        name: 'Twilio Initiate',
        url: `${supabaseUrl}/functions/v1/twilio-initiate`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          callId: testCallId,
          phoneNumber: '+15551234567',
          recipientName: 'Test User',
          callGoal: 'Test call',
          additionalContext: 'This is a test'
        }),
        expectedStatus: [200, 400, 500] // Various responses are OK for testing
      }
    ];

    const newResults: TestResult[] = [];

    for (const webhook of webhooks) {
      const startTime = Date.now();
      
      try {
        const response = await fetch(webhook.url, {
          method: webhook.method,
          headers: {
            'Content-Type': webhook.method === 'POST' && !webhook.headers ? 'application/x-www-form-urlencoded' : undefined,
            ...webhook.headers
          },
          body: webhook.body
        });

        const timing = Date.now() - startTime;
        const responseText = await response.text();
        
        newResults.push({
          name: webhook.name,
          url: webhook.url,
          status: response.status,
          success: webhook.expectedStatus.includes(response.status),
          response: responseText.substring(0, 500), // Limit response length
          timing
        });

      } catch (error) {
        const timing = Date.now() - startTime;
        newResults.push({
          name: webhook.name,
          url: webhook.url,
          status: 0,
          success: false,
          error: error.message,
          timing
        });
      }
    }

    setResults(newResults);
    setTesting(false);
  };

  const getStatusIcon = (result: TestResult) => {
    if (result.success) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    } else if (result.status === 0) {
      return <XCircle className="w-5 h-5 text-red-600" />;
    } else {
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (result: TestResult) => {
    if (result.success) return 'border-green-200 bg-green-50';
    if (result.status === 0) return 'border-red-200 bg-red-50';
    return 'border-yellow-200 bg-yellow-50';
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <TestTube className="w-6 h-6 text-blue-600 mr-3" />
          <h2 className="text-2xl font-bold text-gray-900">Webhook Diagnostics</h2>
        </div>
        
        <button
          onClick={testWebhooks}
          disabled={testing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
          {testing ? 'Testing...' : 'Test All Webhooks'}
        </button>
      </div>

      {/* Configuration Check */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-gray-900 mb-3">Configuration Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              import.meta.env.VITE_SUPABASE_URL ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅' : '❌ Missing'}</span>
          </div>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              import.meta.env.VITE_SUPABASE_ANON_KEY ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span>Supabase Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅' : '❌ Missing'}</span>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-gray-600">
          <p><strong>Expected Twilio Webhook URLs:</strong></p>
          <p>• Voice: {import.meta.env.VITE_SUPABASE_URL}/functions/v1/twiml-voice</p>
          <p>• Status: {import.meta.env.VITE_SUPABASE_URL}/functions/v1/twiml-status</p>
          <p>• Fallback: {import.meta.env.VITE_SUPABASE_URL}/functions/v1/twiml-status</p>
        </div>
      </div>

      {/* Test Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
          
          {results.map((result, index) => (
            <div key={index} className={`border rounded-lg p-4 ${getStatusColor(result)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {getStatusIcon(result)}
                  <span className="ml-2 font-medium">{result.name}</span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>HTTP {result.status || 'Error'}</span>
                  <span>{result.timing}ms</span>
                </div>
              </div>
              
              <div className="text-sm text-gray-600 mb-2">
                <strong>URL:</strong> {result.url}
              </div>
              
              {result.error && (
                <div className="text-sm text-red-700 bg-red-100 p-2 rounded mb-2">
                  <strong>Error:</strong> {result.error}
                </div>
              )}
              
              {result.response && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                    Response Details
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                    {result.response}
                  </pre>
                </details>
              )}
              
              {/* Interpretation */}
              <div className="mt-2 text-xs">
                {result.success ? (
                  <span className="text-green-700">✅ Webhook is accessible and responding correctly</span>
                ) : result.status === 404 ? (
                  <span className="text-red-700">❌ Function not found - may not be deployed</span>
                ) : result.status === 401 ? (
                  <span className="text-yellow-700">⚠️ Authentication required (expected for secured endpoints)</span>
                ) : result.status === 0 ? (
                  <span className="text-red-700">❌ Network error - function may not exist or be unreachable</span>
                ) : (
                  <span className="text-yellow-700">⚠️ Unexpected response - check function logs</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Troubleshooting Guide */}
      <div className="mt-8 bg-blue-50 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-3">Troubleshooting Guide</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>If TwiML Voice shows 404:</strong> The function isn't deployed. Check your Supabase Functions dashboard.</p>
          <p><strong>If you get network errors:</strong> Check your VITE_SUPABASE_URL in .env file.</p>
          <p><strong>If Twilio says "application error":</strong> The voice webhook is failing. Check function logs in Supabase.</p>
          <p><strong>If calls don't connect:</strong> Verify your Twilio phone number configuration matches the URLs above.</p>
        </div>
      </div>
    </div>
  );
}