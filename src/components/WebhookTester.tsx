import React, { useState } from 'react';
import { TestTube, CheckCircle, XCircle, AlertTriangle, RefreshCw, Info } from 'lucide-react';

interface TestResult {
  name: string;
  url: string;
  status: number;
  success: boolean;
  response?: string;
  error?: string;
  timing: number;
  interpretation: string;
  severity: 'success' | 'warning' | 'error';
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
        name: 'TwiML Voice (Basic Test)',
        url: `${supabaseUrl}/functions/v1/twiml-voice?callId=${testCallId}`,
        method: 'GET',
        description: 'Tests if the voice webhook function exists and is deployed'
      },
      {
        name: 'TwiML Voice (Simulated Twilio)',
        url: `${supabaseUrl}/functions/v1/twiml-voice?callId=${testCallId}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TwilioProxy/1.1'
        },
        body: new URLSearchParams({
          CallSid: 'CAtest123456789',
          CallStatus: 'in-progress',
          From: '+15551234567',
          To: '+15559876543',
          AccountSid: 'ACtest123456789'
        }),
        description: 'Simulates a real Twilio webhook call'
      },
      {
        name: 'TwiML Status (Simulated Twilio)',
        url: `${supabaseUrl}/functions/v1/twiml-status?callId=${testCallId}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TwilioProxy/1.1'
        },
        body: new URLSearchParams({
          CallSid: 'CAtest123456789',
          CallStatus: 'completed',
          CallDuration: '45',
          AccountSid: 'ACtest123456789'
        }),
        description: 'Tests the status callback webhook'
      },
      {
        name: 'TwiML Gather (Simulated Twilio)',
        url: `${supabaseUrl}/functions/v1/twiml-gather?callId=${testCallId}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TwilioProxy/1.1'
        },
        body: new URLSearchParams({
          CallSid: 'CAtest123456789',
          SpeechResult: 'Hello, I would like to make an appointment',
          Confidence: '0.95',
          AccountSid: 'ACtest123456789'
        }),
        description: 'Tests the speech gathering webhook'
      },
      {
        name: 'Twilio Initiate (Authenticated)',
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
        description: 'Tests the call initiation function with proper auth'
      }
    ];

    const newResults: TestResult[] = [];

    for (const webhook of webhooks) {
      const startTime = Date.now();
      
      try {
        const response = await fetch(webhook.url, {
          method: webhook.method,
          headers: webhook.headers,
          body: webhook.body
        });

        const timing = Date.now() - startTime;
        const responseText = await response.text();
        
        // Determine success and interpretation based on the specific test
        let success = false;
        let interpretation = '';
        let severity: 'success' | 'warning' | 'error' = 'error';

        if (webhook.name.includes('TwiML Voice (Basic Test)')) {
          if (response.status === 401) {
            success = true;
            severity = 'warning';
            interpretation = 'Function exists but requires authentication (expected for security)';
          } else if (response.status === 200) {
            success = true;
            severity = 'success';
            interpretation = 'Function accessible and responding';
          } else if (response.status === 404) {
            interpretation = 'Function not found - not deployed to Supabase';
          } else {
            interpretation = `Unexpected status ${response.status}`;
          }
        } else if (webhook.name.includes('Simulated Twilio')) {
          if (response.status === 200) {
            success = true;
            severity = 'success';
            interpretation = 'Webhook working correctly - returns proper TwiML/response';
          } else if (response.status === 401) {
            severity = 'warning';
            interpretation = 'Function exists but authentication failed (may need Twilio signature validation)';
          } else if (response.status === 404) {
            interpretation = 'Function not found - not deployed to Supabase';
          } else {
            interpretation = `Function error: HTTP ${response.status}`;
          }
        } else if (webhook.name.includes('Authenticated')) {
          if (response.status === 200) {
            success = true;
            severity = 'success';
            interpretation = 'Function working correctly with authentication';
          } else if (response.status === 400 || response.status === 500) {
            severity = 'warning';
            interpretation = 'Function accessible but returned error (check logs for details)';
          } else if (response.status === 401) {
            interpretation = 'Authentication failed - check SUPABASE_ANON_KEY';
          } else {
            interpretation = `Unexpected response: HTTP ${response.status}`;
          }
        }
        
        newResults.push({
          name: webhook.name,
          url: webhook.url,
          status: response.status,
          success,
          response: responseText.substring(0, 1000),
          timing,
          interpretation,
          severity
        });

      } catch (error) {
        const timing = Date.now() - startTime;
        newResults.push({
          name: webhook.name,
          url: webhook.url,
          status: 0,
          success: false,
          error: error.message,
          timing,
          interpretation: 'Network error - function may not exist or be unreachable',
          severity: 'error'
        });
      }
    }

    setResults(newResults);
    setTesting(false);
  };

  const getStatusIcon = (result: TestResult) => {
    switch (result.severity) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusColor = (result: TestResult) => {
    switch (result.severity) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'error':
        return 'border-red-200 bg-red-50';
    }
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

      {/* Important Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Webhook Testing</p>
            <p>These tests simulate how Twilio calls your webhooks. A 401 "authentication required" response means the function exists but is properly secured. Real Twilio calls include authentication headers that these tests don't have.</p>
          </div>
        </div>
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
          <p><strong>Twilio Webhook URLs (copy these to Twilio Console):</strong></p>
          <div className="bg-white p-2 rounded border mt-1 font-mono text-xs">
            <p>Voice: {import.meta.env.VITE_SUPABASE_URL}/functions/v1/twiml-voice</p>
            <p>Status: {import.meta.env.VITE_SUPABASE_URL}/functions/v1/twiml-status</p>
            <p>Fallback: {import.meta.env.VITE_SUPABASE_URL}/functions/v1/twiml-status</p>
          </div>
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
              
              {/* Clear Interpretation */}
              <div className={`text-sm p-2 rounded mb-2 ${
                result.severity === 'success' ? 'bg-green-100 text-green-800' :
                result.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                <strong>Result:</strong> {result.interpretation}
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
            </div>
          ))}
        </div>
      )}

      {/* Troubleshooting Guide */}
      <div className="mt-8 bg-blue-50 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-3">What the Results Mean</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>✅ Green (Success):</strong> Function is working correctly</p>
          <p><strong>⚠️ Yellow (Warning):</strong> Function exists but has authentication/configuration issues</p>
          <p><strong>❌ Red (Error):</strong> Function not found or network error</p>
          <p className="mt-3 font-medium">If Twilio says "application error occurred":</p>
          <p>• Check that TwiML Voice shows green or yellow (not red)</p>
          <p>• Look at Supabase Function logs for error details</p>
          <p>• Verify Twilio webhook URLs match exactly</p>
        </div>
      </div>
    </div>
  );
}