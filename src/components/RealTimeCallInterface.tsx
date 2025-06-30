import React, { useState, useEffect, useRef } from 'react';
import { Phone, MessageSquare, Send, AlertCircle, Clock, User, Bot, Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { CallRecord } from '../types';
import { subscribeToCallUpdates, getCallStatus } from '../utils/realApi';

interface RealTimeCallInterfaceProps {
  callRecord: CallRecord;
  onComplete: () => void;
}

interface ConversationTurn {
  timestamp: string;
  speaker: 'ai' | 'human';
  text: string;
  confidence?: number;
}

interface PendingQuestion {
  id: string;
  question: string;
  context: string;
  timestamp: string;
  answered: boolean;
  answer?: string;
}

export default function RealTimeCallInterface({ callRecord: initialCallRecord, onComplete }: RealTimeCallInterfaceProps) {
  const [callRecord, setCallRecord] = useState<CallRecord>(initialCallRecord);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isWaitingForConversation, setIsWaitingForConversation] = useState(true);
  
  const conversationRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number>();
  const subscriptionRef = useRef<any>();

  useEffect(() => {
    console.log('RealTimeCallInterface mounted with call:', callRecord.id, 'status:', callRecord.status);
    
    // Parse initial transcript if available
    if (callRecord.result?.transcript) {
      console.log('Initial transcript found:', callRecord.result.transcript.length, 'characters');
      parseTranscript(callRecord.result.transcript);
      setIsWaitingForConversation(false);
    } else {
      console.log('No initial transcript found');
    }

    // Set initial duration from database if call is completed
    if (callRecord.status === 'completed' || callRecord.status === 'failed') {
      console.log('Call already completed, using database duration:', callRecord.duration);
      setCallDuration(callRecord.duration);
    }

    // Set up real-time subscription for call updates
    console.log('Setting up real-time subscription for call:', callRecord.id);
    
    subscriptionRef.current = subscribeToCallUpdates(callRecord.id, (updatedCallRecord) => {
      console.log('Received real-time update:', {
        id: updatedCallRecord.id,
        status: updatedCallRecord.status,
        transcriptLength: updatedCallRecord.result?.transcript?.length || 0,
        duration: updatedCallRecord.duration
      });
      
      setCallRecord(updatedCallRecord);
      setLastUpdate(new Date().toLocaleTimeString());
      setConnectionStatus('connected');
      
      // Update duration if call is completed
      if ((updatedCallRecord.status === 'completed' || updatedCallRecord.status === 'failed') && updatedCallRecord.duration > 0) {
        console.log('Call completed, setting final duration:', updatedCallRecord.duration);
        setCallDuration(updatedCallRecord.duration);
      }
      
      // Parse new transcript
      if (updatedCallRecord.result?.transcript) {
        console.log('Parsing updated transcript:', updatedCallRecord.result.transcript.length, 'characters');
        parseTranscript(updatedCallRecord.result.transcript);
        setIsWaitingForConversation(false);
      }

      // Check if call completed
      if (updatedCallRecord.status === 'completed' || updatedCallRecord.status === 'failed') {
        console.log('Call completed, status:', updatedCallRecord.status);
        if (intervalRef.current) {
          console.log('Stopping duration timer');
          clearInterval(intervalRef.current);
          intervalRef.current = undefined;
        }
        
        // Auto-close after showing final state for a few seconds
        setTimeout(() => {
          onComplete();
        }, 5000);
      }
    });

    // Set up aggressive periodic refresh as fallback
    const refreshInterval = setInterval(async () => {
      if (callRecord.status === 'in-progress' || callRecord.status === 'dialing') {
        try {
          console.log('Fallback refresh checking for updates...');
          const response = await getCallStatus(callRecord.id);
          if (response.success && response.data) {
            const updatedRecord = response.data;
            
            // Check for any changes
            const hasStatusChange = updatedRecord.status !== callRecord.status;
            const hasTranscriptChange = updatedRecord.result?.transcript !== callRecord.result?.transcript;
            const hasDurationChange = updatedRecord.duration !== callRecord.duration;
            
            if (hasStatusChange || hasTranscriptChange || hasDurationChange) {
              console.log('Fallback refresh detected changes:', {
                statusChange: hasStatusChange,
                transcriptChange: hasTranscriptChange,
                durationChange: hasDurationChange,
                newStatus: updatedRecord.status,
                newTranscriptLength: updatedRecord.result?.transcript?.length || 0,
                newDuration: updatedRecord.duration
              });
              
              setCallRecord(updatedRecord);
              setLastUpdate(new Date().toLocaleTimeString());
              
              // Update duration if call is completed
              if ((updatedRecord.status === 'completed' || updatedRecord.status === 'failed') && updatedRecord.duration > 0) {
                console.log('Fallback refresh: Call completed, setting final duration:', updatedRecord.duration);
                setCallDuration(updatedRecord.duration);
                if (intervalRef.current) {
                  clearInterval(intervalRef.current);
                  intervalRef.current = undefined;
                }
              }
              
              if (updatedRecord.result?.transcript) {
                parseTranscript(updatedRecord.result.transcript);
                setIsWaitingForConversation(false);
              }
            }
          }
        } catch (error) {
          console.error('Fallback refresh failed:', error);
          setConnectionStatus('disconnected');
        }
      }
    }, 2000); // Check every 2 seconds for more responsive updates

    // Start duration timer only for active calls
    if (callRecord.status === 'in-progress' || callRecord.status === 'dialing') {
      console.log('Starting duration timer for active call');
      const startTime = new Date(callRecord.createdAt).getTime();
      intervalRef.current = window.setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setCallDuration(elapsed);
      }, 1000);
    } else {
      console.log('Call not active, not starting timer. Status:', callRecord.status);
    }

    return () => {
      console.log('RealTimeCallInterface unmounting, cleaning up subscriptions');
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      clearInterval(refreshInterval);
    };
  }, [callRecord.id]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [conversationHistory]);

  const parseTranscript = (transcript: string) => {
    console.log('Parsing transcript:', transcript.substring(0, 200) + '...');
    
    const lines = transcript.split('\n').filter(line => line.trim());
    const history: ConversationTurn[] = [];
    
    for (const line of lines) {
      if (line.startsWith('Assistente:')) {
        history.push({
          timestamp: new Date().toISOString(),
          speaker: 'ai',
          text: line.replace('Assistente:', '').trim(),
          confidence: 0.9
        });
      } else if (line.startsWith('Pessoa:')) {
        const text = line.replace('Pessoa:', '').trim();
        history.push({
          timestamp: new Date().toISOString(),
          speaker: 'human',
          text: text,
          confidence: 0.9
        });
        
        // Check if this might be a question the AI couldn't answer
        checkForUnansweredQuestion(text);
      }
    }
    
    console.log('Parsed conversation history:', history.length, 'turns');
    setConversationHistory(history);
  };

  const checkForUnansweredQuestion = (humanText: string) => {
    const lowerText = humanText.toLowerCase();
    const questionIndicators = [
      'what time', 'when do', 'how much', 'what is the price', 'do you have',
      'can you tell me', 'i need to know', 'what about', 'how long',
      'que horas', 'quando', 'quanto custa', 'vocês têm', 'podem me dizer',
      'preciso saber', 'e sobre', 'quanto tempo'
    ];

    const aiUncertaintyPhrases = [
      'não tenho essa informação', 'preciso verificar', 'não sei',
      'vou precisar consultar', 'não tenho certeza', 'deixe-me verificar'
    ];

    // Check if human asked a question and AI might not have the answer
    if (questionIndicators.some(indicator => lowerText.includes(indicator))) {
      // Look at the last AI response to see if it indicated uncertainty
      const lastAiResponse = conversationHistory
        .filter(turn => turn.speaker === 'ai')
        .pop();

      if (lastAiResponse && 
          aiUncertaintyPhrases.some(phrase => 
            lastAiResponse.text.toLowerCase().includes(phrase)
          )) {
        
        const newQuestion: PendingQuestion = {
          id: Date.now().toString(),
          question: humanText,
          context: `Customer asked: "${humanText}"`,
          timestamp: new Date().toISOString(),
          answered: false
        };
        
        setPendingQuestions(prev => [...prev, newQuestion]);
      }
    }
  };

  const handleAnswerQuestion = async (questionId: string) => {
    if (!currentAnswer.trim()) return;
    
    setIsAnswering(true);
    
    try {
      // Send answer to AI conversation function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          callId: callRecord.id,
          userInput: currentAnswer,
          conversationHistory: conversationHistory,
          isAssistantInput: true
        })
      });

      if (response.ok) {
        // Mark question as answered
        setPendingQuestions(prev => 
          prev.map(q => 
            q.id === questionId 
              ? { ...q, answered: true, answer: currentAnswer }
              : q
          )
        );
        
        setCurrentAnswer('');
      }
    } catch (error) {
      console.error('Failed to send answer to AI:', error);
    } finally {
      setIsAnswering(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      console.log('Manual refresh triggered');
      const response = await getCallStatus(callRecord.id);
      if (response.success && response.data) {
        console.log('Manual refresh successful:', response.data.status, 'duration:', response.data.duration);
        setCallRecord(response.data);
        setLastUpdate(new Date().toLocaleTimeString());
        
        // Update duration if call is completed
        if ((response.data.status === 'completed' || response.data.status === 'failed') && response.data.duration > 0) {
          console.log('Manual refresh: Call completed, setting final duration:', response.data.duration);
          setCallDuration(response.data.duration);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
          }
        }
        
        if (response.data.result?.transcript) {
          parseTranscript(response.data.result.transcript);
          setIsWaitingForConversation(false);
        }
      }
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    switch (callRecord.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'in-progress':
        return <Phone className="w-5 h-5 text-blue-600 animate-pulse" />;
      default:
        return <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (callRecord.status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600';
      case 'disconnected':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          {getStatusIcon()}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Live Call Monitor</h2>
            <p className="text-gray-600">{callRecord.recipientName} • {callRecord.phoneNumber}</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
            {callRecord.status.charAt(0).toUpperCase() + callRecord.status.slice(1)}
          </div>
          <div className="flex items-center text-sm text-gray-500 mt-1">
            <Clock className="w-4 h-4 mr-1" />
            {formatTime(callDuration)}
            {(callRecord.status === 'completed' || callRecord.status === 'failed') && (
              <span className="ml-1 text-xs text-gray-400">(final)</span>
            )}
          </div>
          <div className="flex items-center justify-between mt-1">
            {lastUpdate && (
              <div className="text-xs text-gray-400">
                Last update: {lastUpdate}
              </div>
            )}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="ml-2 p-1 text-gray-400 hover:text-gray-600"
              title="Refresh call status"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className={`text-xs ${getConnectionStatusColor()}`}>
            ● {connectionStatus}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation Stream */}
        <div className="lg:col-span-2">
          <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-y-auto" ref={conversationRef}>
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Live Conversation
              {conversationHistory.length > 0 && (
                <span className="ml-2 text-sm text-gray-500">
                  ({conversationHistory.length} messages)
                </span>
              )}
            </h3>
            
            {isWaitingForConversation ? (
              <div className="text-center text-gray-500 py-8">
                <Phone className="w-8 h-8 mx-auto mb-2 opacity-50 animate-pulse" />
                <p>Waiting for conversation to begin...</p>
                <p className="text-sm mt-2">Call status: {callRecord.status}</p>
                <p className="text-xs mt-1 text-gray-400">
                  Connection: {connectionStatus} • Last update: {lastUpdate || 'Never'}
                </p>
                {callRecord.status === 'in-progress' && (
                  <div className="mt-4">
                    <button
                      onClick={handleManualRefresh}
                      disabled={isRefreshing}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isRefreshing ? 'Checking...' : 'Check for Updates'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {conversationHistory.map((turn, index) => (
                  <div
                    key={index}
                    className={`flex ${turn.speaker === 'ai' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        turn.speaker === 'ai'
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-green-100 text-green-900'
                      }`}
                    >
                      <div className="flex items-center mb-1">
                        {turn.speaker === 'ai' ? (
                          <Bot className="w-4 h-4 mr-1" />
                        ) : (
                          <User className="w-4 h-4 mr-1" />
                        )}
                        <span className="text-xs font-medium">
                          {turn.speaker === 'ai' ? 'AI Assistant' : callRecord.recipientName}
                        </span>
                      </div>
                      <p className="text-sm">{turn.text}</p>
                      <div className="text-xs opacity-70 mt-1">
                        {new Date(turn.timestamp).toLocaleTimeString()}
                        {turn.confidence && (
                          <span className="ml-2">({Math.round(turn.confidence * 100)}%)</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Assistant Panel */}
        <div className="space-y-6">
          {/* Call Info */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Call Objective</h4>
            <p className="text-blue-800 text-sm">{callRecord.callGoal}</p>
            {callRecord.additionalContext && (
              <div className="mt-2">
                <h5 className="font-medium text-blue-900 text-sm">Context:</h5>
                <p className="text-blue-700 text-xs">{callRecord.additionalContext}</p>
              </div>
            )}
          </div>

          {/* Pending Questions */}
          {pendingQuestions.length > 0 && (
            <div className="bg-orange-50 rounded-lg p-4">
              <h4 className="font-semibold text-orange-900 mb-3 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                AI Needs Help ({pendingQuestions.filter(q => !q.answered).length})
              </h4>
              
              <div className="space-y-3">
                {pendingQuestions.map((question) => (
                  <div
                    key={question.id}
                    className={`p-3 rounded border ${
                      question.answered 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-white border-orange-200'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      Customer asked:
                    </p>
                    <p className="text-sm text-gray-700 mb-2">"{question.question}"</p>
                    
                    {question.answered ? (
                      <div className="text-xs text-green-700">
                        ✓ Answered: {question.answer}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          value={currentAnswer}
                          onChange={(e) => setCurrentAnswer(e.target.value)}
                          placeholder="Provide the information the AI needs..."
                          className="w-full text-sm p-2 border border-gray-300 rounded resize-none"
                          rows={2}
                        />
                        <button
                          onClick={() => handleAnswerQuestion(question.id)}
                          disabled={!currentAnswer.trim() || isAnswering}
                          className="flex items-center px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 disabled:opacity-50"
                        >
                          {isAnswering ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3 mr-1" />
                          )}
                          Send to AI
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Call Statistics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Call Statistics</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium">
                  {formatTime(callDuration)}
                  {(callRecord.status === 'completed' || callRecord.status === 'failed') && (
                    <span className="text-xs text-gray-500 ml-1">(final)</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Exchanges:</span>
                <span className="font-medium">{Math.floor(conversationHistory.length / 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="font-medium capitalize">{callRecord.status}</span>
              </div>
              {pendingQuestions.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Questions:</span>
                  <span className="font-medium">
                    {pendingQuestions.filter(q => q.answered).length}/{pendingQuestions.length} answered
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Connection:</span>
                <span className={`font-medium capitalize ${getConnectionStatusColor()}`}>
                  {connectionStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Debug Info */}
          <div className="bg-gray-100 rounded-lg p-3">
            <h5 className="font-medium text-gray-700 mb-2 text-sm">Debug Info</h5>
            <div className="text-xs text-gray-600 space-y-1">
              <div>Call ID: {callRecord.id}</div>
              <div>Created: {new Date(callRecord.createdAt).toLocaleString()}</div>
              {callRecord.completedAt && (
                <div>Completed: {new Date(callRecord.completedAt).toLocaleString()}</div>
              )}
              <div>DB Duration: {callRecord.duration}s</div>
              <div>UI Duration: {callDuration}s</div>
              <div>Timer Active: {intervalRef.current ? 'Yes' : 'No'}</div>
              <div>Transcript Length: {callRecord.result?.transcript?.length || 0} chars</div>
              <div>Conversation Turns: {conversationHistory.length}</div>
              <div>Waiting for Conversation: {isWaitingForConversation ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Call Completed State */}
      {(callRecord.status === 'completed' || callRecord.status === 'failed') && (
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">Call Summary</h4>
          {callRecord.result && (
            <div className="space-y-2 text-sm">
              <p><strong>Result:</strong> {callRecord.result.message}</p>
              {callRecord.result.details && (
                <p><strong>Details:</strong> {callRecord.result.details}</p>
              )}
              <p><strong>Duration:</strong> {formatTime(callRecord.duration)}</p>
              <p><strong>Success:</strong> {callRecord.result.success ? 'Yes' : 'No'}</p>
            </div>
          )}
          
          <button
            onClick={onComplete}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close Call Monitor
          </button>
        </div>
      )}
    </div>
  );
}