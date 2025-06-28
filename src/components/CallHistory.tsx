import React, { useState, useEffect } from 'react';
import { History, Phone, Clock, CheckCircle, XCircle, Filter, Search, ChevronDown } from 'lucide-react';
import { CallRecord } from '../types';
import { getAllCalls } from '../utils/mockApi';

interface CallHistoryProps {
  onCallSelect?: (call: CallRecord) => void;
  refreshTrigger?: number;
}

export default function CallHistory({ onCallSelect, refreshTrigger }: CallHistoryProps) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date');
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  useEffect(() => {
    loadCalls();
  }, [refreshTrigger]);

  const loadCalls = async () => {
    setLoading(true);
    try {
      const response = await getAllCalls();
      if (response.success && response.data) {
        setCalls(response.data);
      }
    } catch (error) {
      console.error('Failed to load call history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = calls
    .filter(call => {
      const matchesSearch = call.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           call.phoneNumber.includes(searchTerm) ||
                           call.callGoal.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || call.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        return a.status.localeCompare(b.status);
      }
    });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
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

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <div className="flex items-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mr-4">
          <History className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Call History</h2>
          <p className="text-gray-600">{calls.length} total calls</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, number, or goal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="in-progress">In Progress</option>
          <option value="preparing">Preparing</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date' | 'status')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="date">Sort by Date</option>
          <option value="status">Sort by Status</option>
        </select>
      </div>

      {/* Call List */}
      <div className="space-y-4">
        {filteredCalls.length === 0 ? (
          <div className="text-center py-12">
            <Phone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' ? 'No calls match your filters' : 'No calls yet'}
            </p>
          </div>
        ) : (
          filteredCalls.map((call) => (
            <div key={call.id} className="border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <div 
                className="p-4 cursor-pointer"
                onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(call.status)}
                    <div>
                      <h3 className="font-semibold text-gray-900">{call.recipientName}</h3>
                      <p className="text-sm text-gray-600">{call.phoneNumber}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                        {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">{formatDate(call.createdAt)}</p>
                    </div>
                    <ChevronDown 
                      className={`w-5 h-5 text-gray-400 transform transition-transform ${
                        expandedCall === call.id ? 'rotate-180' : ''
                      }`} 
                    />
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedCall === call.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Goal:</span>
                      <p className="font-medium text-gray-900">{call.callGoal}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Duration:</span>
                      <p className="font-medium text-gray-900">{formatDuration(call.duration)}</p>
                    </div>
                  </div>
                  
                  {call.additionalContext && (
                    <div className="mt-3">
                      <span className="text-gray-500 text-sm">Context:</span>
                      <p className="text-gray-700 text-sm mt-1">{call.additionalContext}</p>
                    </div>
                  )}

                  {call.result && (
                    <div className="mt-4 p-3 bg-white rounded-lg border">
                      <h4 className="font-medium text-gray-900 mb-2">Result:</h4>
                      <p className={`text-sm mb-2 ${call.result.success ? 'text-green-700' : 'text-red-700'}`}>
                        {call.result.message}
                      </p>
                      {call.result.details && (
                        <p className="text-sm text-gray-600">{call.result.details}</p>
                      )}
                    </div>
                  )}

                  {onCallSelect && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCallSelect(call);
                      }}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Details
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}