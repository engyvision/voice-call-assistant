import React, { useState } from 'react';
import { Bug, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface DebugData {
  database_calls?: any[];
  twilio_calls?: any[];
  comparison?: any;
  alerts?: any[];
  webhook_tests?: any[];
  error?: string;
}

export default function DebugPanel() {
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'calls' | 'logs' | 'webhooks'>('calls');

  const fetchDebugData = async (action: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-debug?action=${action}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      setDebugData(data);
    } catch (error) {
      console.error('Debug fetch error:', error);
      setDebugData({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex items-center mb-6">
        <Bug className="w-6 h-6 text-red-600 mr-3" />
        <h2 className="text-2xl font-bold text-gray-900">Twilio Debug Panel</h2>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('calls')}
          className={`pb-2 px-1 font-medium ${
            activeTab === 'calls' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Call Comparison
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-2 px-1 font-medium ${
            activeTab === 'logs' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Twilio Logs
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`pb-2 px-1 font-medium ${
            activeTab === 'webhooks' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Webhook Tests
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3 mb-6">
        <button
          onClick={() => fetchDebugData('recent_calls')}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Check Recent Calls
        </button>
        <button
          onClick={() => fetchDebugData('twilio_logs')}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Get Twilio Logs
        </button>
        <button
          onClick={() => fetchDebugData('webhook_test')}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Test Webhooks
        </button>
      </div>

      {/* Configuration Status */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-gray-900 mb-3">Configuration Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              import.meta.env.VITE_SUPABASE_URL ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ Configured' : '❌ Missing'}</span>
          </div>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              import.meta.env.VITE_SUPABASE_ANON_KEY ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span>Supabase Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Configured' : '❌ Missing'}</span>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-gray-600">
          <p><strong>Webhook URLs:</strong></p>
          <p>• Voice: {import.meta.env.VITE_SUPABASE_URL}/functions/v1/twiml-voice</p>
          <p>• Status: {import.meta.env.VITE_SUPABASE_URL}/functions/v1/twiml-status</p>
          <p>• Gather: {import.meta.env.VITE_SUPABASE_URL}/functions/v1/twiml-gather</p>
        </div>
      </div>

      {/* Debug Results */}
      {debugData && (
        <div className="space-y-6">
          {debugData.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <XCircle className="w-5 h-5 text-red-600 mr-2" />
                <span className="text-red-800 font-medium">Error</span>
              </div>
              <p className="text-red-700 mt-1">{debugData.error}</p>
              
              {debugData.error.includes('Missing authorization header') && (
                <div className="mt-3 p-3 bg-red-100 rounded text-sm">
                  <p className="font-medium text-red-800">Authentication Issue Detected</p>
                  <p className="text-red-700">The webhook endpoints require proper authentication. This is expected behavior for security.</p>
                </div>
              )}
            </div>
          )}

          {/* Call Comparison Tab */}
          {activeTab === 'calls' && debugData.database_calls && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Call Status Comparison</h3>
              
              {debugData.comparison && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{debugData.comparison.matched_calls}</div>
                    <div className="text-sm text-green-700">Matched Calls</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{debugData.comparison.discrepancies?.length || 0}</div>
                    <div className="text-sm text-yellow-700">Status Discrepancies</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{debugData.comparison.unmatched_db_calls}</div>
                    <div className="text-sm text-red-700">Unmatched DB Calls</div>
                  </div>
                </div>
              )}

              {debugData.comparison?.discrepancies?.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Status Discrepancies Found:</h4>
                  <div className="space-y-2">
                    {debugData.comparison.discrepancies.map((disc: any, index: number) => (
                      <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900">{disc.phone_number}</div>
                            <div className="text-sm text-gray-600">Call ID: {disc.call_id}</div>
                            <div className="text-sm text-gray-600">Twilio SID: {disc.twilio_sid}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm">
                              <span className="text-gray-600">DB:</span> 
                              <span className="ml-1 font-medium">{disc.db_status}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600">Twilio:</span> 
                              <span className="ml-1 font-medium">{disc.twilio_status}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Recent Database Calls</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {debugData.database_calls.map((call: any) => (
                      <div key={call.id} className="bg-gray-50 p-3 rounded-lg text-sm">
                        <div className="font-medium">{call.recipient_name}</div>
                        <div className="text-gray-600">{call.phone_number}</div>
                        <div className="flex justify-between mt-1">
                          <span className={`px-2 py-1 rounded text-xs ${
                            call.status === 'completed' ? 'bg-green-100 text-green-800' :
                            call.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {call.status}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {new Date(call.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {debugData.twilio_calls && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Recent Twilio Calls</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {debugData.twilio_calls.map((call: any) => (
                        <div key={call.sid} className="bg-gray-50 p-3 rounded-lg text-sm">
                          <div className="font-medium">{call.to}</div>
                          <div className="text-gray-600">SID: {call.sid}</div>
                          <div className="flex justify-between mt-1">
                            <span className={`px-2 py-1 rounded text-xs ${
                              call.status === 'completed' ? 'bg-green-100 text-green-800' :
                              call.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {call.status}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {new Date(call.date_created).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Twilio Logs Tab */}
          {activeTab === 'logs' && debugData.alerts && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Twilio Alerts & Logs</h3>
              
              {debugData.webhook_urls && (
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium text-blue-900 mb-2">Webhook URLs</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>Voice:</strong> {debugData.webhook_urls.voice}</div>
                    <div><strong>Status:</strong> {debugData.webhook_urls.status}</div>
                    <div><strong>Gather:</strong> {debugData.webhook_urls.gather}</div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {debugData.alerts.length === 0 ? (
                  <div className="text-gray-500 text-center py-4">No recent alerts found</div>
                ) : (
                  debugData.alerts.map((alert: any, index: number) => (
                    <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-red-900">{alert.alert_text}</div>
                          <div className="text-sm text-red-700 mt-1">{alert.log_level}</div>
                        </div>
                        <div className="text-sm text-red-600">
                          {new Date(alert.date_created).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Webhook Tests Tab */}
          {activeTab === 'webhooks' && debugData.webhook_tests && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhook Test Results</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-blue-900 mb-2">About Webhook Testing</h4>
                <p className="text-sm text-blue-800">
                  Webhook endpoints are secured and require proper authentication from Twilio. 
                  401 errors in testing are expected and indicate the security is working correctly.
                  Real webhook calls from Twilio will include proper authentication headers.
                </p>
              </div>
              
              <div className="space-y-3">
                {debugData.webhook_tests.map((test: any, index: number) => (
                  <div key={index} className={`border rounded-lg p-4 ${
                    test.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{test.name}</div>
                      <div className="flex items-center">
                        {test.success ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <span className="ml-2 text-sm">HTTP {test.status}</span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">{test.url}</div>
                    {test.error && (
                      <div className="text-sm text-red-700 bg-red-100 p-2 rounded">
                        Error: {test.error}
                      </div>
                    )}
                    {test.response_text && (
                      <details className="mt-2">
                        <summary className="text-sm text-gray-600 cursor-pointer">Response Details</summary>
                        <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                          {test.response_text}
                        </pre>
                      </details>
                    )}
                    
                    {test.status === 401 && (
                      <div className="mt-2 p-2 bg-blue-100 rounded text-xs text-blue-800">
                        <strong>Note:</strong> 401 Unauthorized is expected for webhook tests. 
                        This confirms the endpoint is properly secured and will only accept authenticated requests from Twilio.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}