import React, { useState } from 'react';
import { Volume2, AlertTriangle, CheckCircle, RefreshCw, Copy, ExternalLink } from 'lucide-react';
import { ElevenLabsTestService } from '../utils/elevenLabsTest';

export default function ElevenLabsFixGuide() {
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [portugueseVoices, setPortugueseVoices] = useState<any[]>([]);

  const runTest = async () => {
    setTesting(true);
    const testService = new ElevenLabsTestService();
    
    try {
      const result = await testService.testConnection();
      setTestResult(result);
      
      if (result.success || result.details?.availablePortugueseVoices) {
        const voices = await testService.getPortugueseVoices();
        setPortugueseVoices(voices);
      }
    } catch (error) {
      setTestResult({
        success: false,
        error: 'Test failed with exception',
        details: error.message
      });
    }
    
    setTesting(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-white rounded-lg border border-orange-200 p-6">
      <div className="flex items-center mb-4">
        <Volume2 className="w-6 h-6 text-orange-600 mr-3" />
        <h3 className="text-lg font-semibold text-gray-900">ElevenLabs Connection Fix</h3>
      </div>

      <div className="space-y-4">
        {/* Test Button */}
        <button
          onClick={runTest}
          disabled={testing}
          className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
          {testing ? 'Testing ElevenLabs...' : 'Test ElevenLabs Connection'}
        </button>

        {/* Test Results */}
        {testResult && (
          <div className={`p-4 rounded-lg border ${
            testResult.success 
              ? 'border-green-200 bg-green-50' 
              : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center mb-2">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              )}
              <span className="font-medium">
                {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
              </span>
            </div>
            
            {testResult.error && (
              <p className="text-red-700 mb-2">{testResult.error}</p>
            )}
            
            {testResult.details && (
              <div className="text-sm text-gray-600">
                <strong>Details:</strong>
                <pre className="mt-1 p-2 bg-white rounded text-xs overflow-auto">
                  {JSON.stringify(testResult.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Common Issues and Fixes */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-3">Common ElevenLabs Issues & Fixes</h4>
          
          <div className="space-y-3 text-sm">
            <div className="border-l-4 border-blue-400 pl-3">
              <strong>Issue 1: "Failed to fetch" or CORS Error</strong>
              <p className="text-blue-800 mt-1">
                This is normal when testing from the browser. ElevenLabs API works fine from your Supabase Edge Functions.
                The browser blocks direct API calls due to CORS policy.
              </p>
              <p className="text-blue-700 mt-1 font-medium">
                ✅ Solution: This error in diagnostics is expected. Your Edge Functions can still call ElevenLabs successfully.
              </p>
            </div>

            <div className="border-l-4 border-yellow-400 pl-3">
              <strong>Issue 2: Invalid API Key (401 Error)</strong>
              <p className="text-yellow-800 mt-1">
                Your ElevenLabs API key is incorrect or expired.
              </p>
              <div className="mt-2">
                <p className="text-yellow-700 font-medium">🔧 Solution:</p>
                <ol className="list-decimal list-inside text-yellow-700 mt-1 space-y-1">
                  <li>Go to <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="underline">ElevenLabs API Keys</a></li>
                  <li>Generate a new API key</li>
                  <li>Update your .env file with the new key</li>
                  <li>Restart your development server</li>
                </ol>
              </div>
            </div>

            <div className="border-l-4 border-purple-400 pl-3">
              <strong>Issue 3: Voice ID Not Found</strong>
              <p className="text-purple-800 mt-1">
                The configured voice ID doesn't exist or isn't available.
              </p>
              <div className="mt-2">
                <p className="text-purple-700 font-medium">🔧 Solution:</p>
                <p className="text-purple-700 mt-1">Use one of these recommended Portuguese voice IDs:</p>
                <div className="mt-2 space-y-1">
                  {[
                    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Multilingual)' },
                    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Multilingual)' },
                    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Multilingual)' }
                  ].map((voice) => (
                    <div key={voice.id} className="flex items-center justify-between bg-white p-2 rounded">
                      <span className="font-mono text-xs">{voice.id}</span>
                      <span className="text-sm">{voice.name}</span>
                      <button
                        onClick={() => copyToClipboard(voice.id)}
                        className="text-purple-600 hover:text-purple-800"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-l-4 border-red-400 pl-3">
              <strong>Issue 4: Insufficient Credits</strong>
              <p className="text-red-800 mt-1">
                Your ElevenLabs account has run out of credits.
              </p>
              <p className="text-red-700 mt-1 font-medium">
                🔧 Solution: <a href="https://elevenlabs.io/app/settings/billing" target="_blank" rel="noopener noreferrer" className="underline">Add credits to your ElevenLabs account</a>
              </p>
            </div>
          </div>
        </div>

        {/* Portuguese Voices */}
        {portugueseVoices.length > 0 && (
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-3">Available Portuguese Voices</h4>
            <div className="space-y-2">
              {portugueseVoices.map((voice) => (
                <div key={voice.voice_id} className="flex items-center justify-between bg-white p-3 rounded border">
                  <div>
                    <div className="font-medium">{voice.name}</div>
                    <div className="text-sm text-gray-600">{voice.labels?.language || 'Portuguese'}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">{voice.voice_id}</code>
                    <button
                      onClick={() => copyToClipboard(voice.voice_id)}
                      className="text-green-600 hover:text-green-800"
                      title="Copy Voice ID"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Environment Variable Setup */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Environment Variable Setup</h4>
          <p className="text-sm text-gray-600 mb-3">
            Add these to your .env file and restart your development server:
          </p>
          <div className="bg-white p-3 rounded border font-mono text-sm">
            <div className="flex items-center justify-between">
              <span>VITE_ELEVENLABS_API_KEY=your_api_key_here</span>
              <button
                onClick={() => copyToClipboard('VITE_ELEVENLABS_API_KEY=your_api_key_here')}
                className="text-gray-600 hover:text-gray-800"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span>VITE_ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB</span>
              <button
                onClick={() => copyToClipboard('VITE_ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB')}
                className="text-gray-600 hover:text-gray-800"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Edge Function Environment Variables */}
        <div className="bg-yellow-50 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 mb-3">⚠️ Important: Supabase Edge Function Setup</h4>
          <p className="text-sm text-yellow-800 mb-3">
            The ElevenLabs API must also be configured in your Supabase Edge Functions:
          </p>
          <ol className="list-decimal list-inside text-sm text-yellow-800 space-y-1">
            <li>Go to your Supabase Dashboard → Edge Functions → Settings</li>
            <li>Add these environment variables:</li>
          </ol>
          <div className="bg-white p-3 rounded border font-mono text-sm mt-2">
            <div>ELEVENLABS_API_KEY=your_api_key_here</div>
            <div>ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB</div>
          </div>
          <p className="text-sm text-yellow-800 mt-2">
            <strong>Note:</strong> Edge Function environment variables don't have the "VITE_" prefix.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex space-x-4 text-sm">
          <a
            href="https://elevenlabs.io/app/settings/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            ElevenLabs API Keys
          </a>
          <a
            href="https://elevenlabs.io/app/voice-library"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            Voice Library
          </a>
          <a
            href="https://elevenlabs.io/app/settings/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            Billing & Credits
          </a>
        </div>
      </div>
    </div>
  );
}