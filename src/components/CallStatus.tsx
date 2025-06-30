import React, { useState, useEffect } from 'react';
import { Phone, Clock, CheckCircle, XCircle, PhoneCall, Loader2, RefreshCw, Brain, Volume2, AlertTriangle, Monitor } from 'lucide-react';
import { CallRecord, CallStatus as CallStatusType, ErrorLog } from '../types';
import { ErrorHandler } from '../utils/errorHandler';
import RealTimeCallInterface from './RealTimeCallInterface';

interface CallStatusProps {
  callRecord: CallRecord;
  onComplete: () => void;
  onRefresh?: () => void;
}

const statusConfig = {
  preparing: {
    icon: Loader2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    message: 'Preparando sua ligação...',
    description: 'Configurando assistente de IA e validando solicitação'
  },
  dialing: {
    icon: Phone,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    message: 'Discando...',
    description: 'Conectando com o destinatário'
  },
  'in-progress': {
    icon: PhoneCall,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    message: 'Ligação em andamento',
    description: 'Assistente de IA está conversando com o destinatário'
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    message: 'Ligação concluída',
    description: 'Ligação finalizada com sucesso'
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    message: 'Ligação falhou',
    description: 'Não foi possível completar a ligação'
  }
};

export default function CallStatus({ callRecord, onComplete, onRefresh }: CallStatusProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [conversationTurns, setConversationTurns] = useState(0);
  const [showRealTimeInterface, setShowRealTimeInterface] = useState(false);

  const config = statusConfig[callRecord.status];
  const IconComponent = config.icon;
  const errorHandler = ErrorHandler.getInstance();

  useEffect(() => {
    // Update error logs
    setErrorLogs(errorHandler.getErrorLogs());
    
    // Count conversation turns from transcript
    if (callRecord.result?.transcript) {
      const turns = callRecord.result.transcript.split('\n').filter(line => 
        line.startsWith('Assistente:') || line.startsWith('Pessoa:')
      ).length;
      setConversationTurns(turns);
    }

    // Auto-show real-time interface for in-progress calls
    if (callRecord.status === 'in-progress') {
      setShowRealTimeInterface(true);
    }
  }, [callRecord]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRefresh = async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      await onRefresh();
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const getElapsedTime = () => {
    if (callRecord.status === 'completed' || callRecord.status === 'failed') {
      return callRecord.duration;
    }
    
    const now = Date.now();
    const start = new Date(callRecord.createdAt).getTime();
    return Math.floor((now - start) / 1000);
  };

  const getAIProvider = () => {
    return callRecord.aiProvider || import.meta.env.VITE_AI_PROVIDER || 'OpenAI';
  };

  const getVoiceProvider = () => {
    return callRecord.voiceProvider || 'ElevenLabs (Português)';
  };

  const recentErrors = errorLogs.filter(log => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    return log.timestamp > fiveMinutesAgo;
  });

  const systemHealthy = errorHandler.isSystemHealthy();

  // Show real-time interface for in-progress calls
  if (showRealTimeInterface && callRecord.status === 'in-progress') {
    return (
      <div className="space-y-4">
        <div className="flex justify-center">
          <button
            onClick={() => setShowRealTimeInterface(false)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            ← Back to Simple View
          </button>
        </div>
        <RealTimeCallInterface 
          callRecord={callRecord} 
          onComplete={onComplete}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl mx-auto">
      <div className="text-center">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${config.bgColor}`}>
          <IconComponent 
            className={`w-10 h-10 ${config.color} ${
              callRecord.status === 'preparing' || callRecord.status === 'dialing' ? 'animate-spin' : ''
            }`} 
          />
        </div>

        <h2 className="text-3xl font-bold text-gray-900 mb-2">{config.message}</h2>
        <p className="text-gray-600 mb-6">{config.description}</p>

        {/* Real-time Interface Button for In-Progress Calls */}
        {callRecord.status === 'in-progress' && (
          <div className="mb-6">
            <button
              onClick={() => setShowRealTimeInterface(true)}
              className="flex items-center justify-center mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              <Monitor className="w-5 h-5 mr-2" />
              View Live Call Monitor
            </button>
            <p className="text-sm text-gray-500 mt-2">
              See real-time conversation and assist the AI when needed
            </p>
          </div>
        )}

        {/* System Health Indicator */}
        <div className="flex items-center justify-center mb-4">
          <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
            systemHealthy ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              systemHealthy ? 'bg-green-500' : 'bg-yellow-500'
            }`}></div>
            Sistema {systemHealthy ? 'Saudável' : 'Com Alertas'}
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Ligando para:</span>
              <p className="font-semibold text-gray-900">{callRecord.recipientName}</p>
            </div>
            <div>
              <span className="text-gray-500">Número:</span>
              <p className="font-semibold text-gray-900">{callRecord.phoneNumber}</p>
            </div>
            <div>
              <span className="text-gray-500">Objetivo:</span>
              <p className="font-semibold text-gray-900">{callRecord.callGoal}</p>
            </div>
            <div>
              <span className="text-gray-500">Duração:</span>
              <p className="font-semibold text-gray-900">
                <Clock className="inline w-4 h-4 mr-1" />
                {formatTime(getElapsedTime())}
              </p>
            </div>
          </div>

          {/* AI and Voice Provider Info */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center">
                <Brain className="w-4 h-4 text-blue-600 mr-2" />
                <span className="text-gray-500">IA:</span>
                <span className="ml-1 font-medium text-gray-900">{getAIProvider()}</span>
              </div>
              <div className="flex items-center">
                <Volume2 className="w-4 h-4 text-purple-600 mr-2" />
                <span className="text-gray-500">Voz:</span>
                <span className="ml-1 font-medium text-gray-900">{getVoiceProvider()}</span>
              </div>
            </div>
          </div>

          {/* Conversation Progress */}
          {conversationTurns > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-center">
                <PhoneCall className="w-4 h-4 text-green-600 mr-2" />
                <span className="text-sm text-gray-600">
                  {Math.floor(conversationTurns / 2)} trocas de conversa
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Error Status */}
        {recentErrors.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              className="flex items-center justify-center mx-auto px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              {recentErrors.length} problema(s) detectado(s)
            </button>
            
            {showErrorDetails && (
              <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-left">
                <h4 className="font-medium text-yellow-900 mb-2">Problemas Recentes:</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {recentErrors.slice(-3).map((error, index) => (
                    <div key={index} className="text-sm">
                      <div className="flex items-center">
                        <span className={`px-2 py-1 rounded text-xs mr-2 ${
                          error.recovered ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {error.type}
                        </span>
                        <span className="text-yellow-800">
                          {errorHandler.getUserFriendlyMessage(error)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual refresh button for active calls */}
        {callRecord.status !== 'completed' && callRecord.status !== 'failed' && onRefresh && (
          <div className="mb-6">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Atualizando...' : 'Atualizar Status'}
            </button>
          </div>
        )}

        {/* Progress bar for active calls */}
        {callRecord.status !== 'completed' && callRecord.status !== 'failed' && (
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${
                  callRecord.status === 'preparing' ? 'bg-blue-600 w-1/4' :
                  callRecord.status === 'dialing' ? 'bg-yellow-600 w-1/2' :
                  callRecord.status === 'in-progress' ? 'bg-green-600 w-3/4' :
                  'w-full'
                }`}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Preparando</span>
              <span>Discando</span>
              <span>Em Andamento</span>
              <span>Completo</span>
            </div>
          </div>
        )}

        {/* Results section for completed/failed calls */}
        {(callRecord.status === 'completed' || callRecord.status === 'failed') && callRecord.result && (
          <div className={`rounded-xl p-6 ${
            callRecord.result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className={`flex items-center justify-center mb-4 ${
              callRecord.result.success ? 'text-green-600' : 'text-red-600'
            }`}>
              {callRecord.result.success ? (
                <CheckCircle className="w-8 h-8 mr-2" />
              ) : (
                <XCircle className="w-8 h-8 mr-2" />
              )}
              <h3 className="text-xl font-bold">{callRecord.result.message}</h3>
            </div>
            
            {callRecord.result.details && (
              <p className={`text-lg mb-4 ${
                callRecord.result.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {callRecord.result.details}
              </p>
            )}

            {/* AI Summary */}
            {callRecord.result.aiSummary && (
              <div className="mb-4 p-4 bg-white rounded-lg border">
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                  <Brain className="w-4 h-4 mr-2" />
                  Resumo da IA:
                </h4>
                <p className="text-sm text-gray-600">{callRecord.result.aiSummary}</p>
              </div>
            )}

            {/* Conversation Transcript */}
            {callRecord.result.transcript && (
              <div className="text-left">
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Transcrição da Conversa:
                </h4>
                <div className="bg-white p-4 rounded-lg border text-sm text-gray-600 max-h-64 overflow-y-auto">
                  {callRecord.result.transcript.split('\n').map((line, index) => (
                    <div key={index} className={`mb-2 ${
                      line.startsWith('Assistente:') ? 'text-blue-700 font-medium' : 
                      line.startsWith('Pessoa:') ? 'text-gray-700' : 'text-gray-500'
                    }`}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sentiment and Objectives */}
            {(callRecord.result.sentiment || callRecord.result.objectives_achieved) && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {callRecord.result.sentiment && (
                  <div className="text-center">
                    <span className="text-gray-500 text-sm">Sentimento:</span>
                    <div className={`mt-1 px-3 py-1 rounded-full text-sm font-medium ${
                      callRecord.result.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                      callRecord.result.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {callRecord.result.sentiment === 'positive' ? 'Positivo' :
                       callRecord.result.sentiment === 'negative' ? 'Negativo' : 'Neutro'}
                    </div>
                  </div>
                )}
                
                {callRecord.result.objectives_achieved && callRecord.result.objectives_achieved.length > 0 && (
                  <div className="text-center">
                    <span className="text-gray-500 text-sm">Objetivos Alcançados:</span>
                    <div className="mt-1">
                      {callRecord.result.objectives_achieved.map((objective, index) => (
                        <span key={index} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-1 mb-1">
                          {objective}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {(callRecord.status === 'completed' || callRecord.status === 'failed') && (
          <button
            onClick={onComplete}
            className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Fazer Outra Ligação
          </button>
        )}

        {/* Debug info */}
        <div className="mt-6 p-4 bg-gray-100 rounded-lg text-sm text-left">
          <h4 className="font-medium mb-2">Informações de Debug:</h4>
          <p><strong>ID da Ligação:</strong> {callRecord.id}</p>
          <p><strong>Status:</strong> {callRecord.status}</p>
          <p><strong>Criado:</strong> {new Date(callRecord.createdAt).toLocaleString()}</p>
          {callRecord.completedAt && (
            <p><strong>Concluído:</strong> {new Date(callRecord.completedAt).toLocaleString()}</p>
          )}
          <p><strong>Duração:</strong> {callRecord.duration} segundos</p>
          <p><strong>Provedor de IA:</strong> {getAIProvider()}</p>
          <p><strong>Provedor de Voz:</strong> {getVoiceProvider()}</p>
          {recentErrors.length > 0 && (
            <p><strong>Erros Recentes:</strong> {recentErrors.length}</p>
          )}
        </div>
      </div>
    </div>
  );
}