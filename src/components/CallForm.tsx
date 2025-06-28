import React, { useState } from 'react';
import { Phone, User, Target, MessageSquare } from 'lucide-react';
import { CallRequest } from '../types';
import { validateCallRequest, formatPhoneNumber, ValidationError } from '../utils/validation';

interface CallFormProps {
  onSubmit: (request: CallRequest) => void;
  isLoading: boolean;
}

const CALL_GOALS = [
  'Book appointment',
  'Get information', 
  'Make reservation',
  'Follow up inquiry',
  'Schedule consultation',
  'Request quote',
  'General inquiry',
  'Other'
];

export default function CallForm({ onSubmit, isLoading }: CallFormProps) {
  const [formData, setFormData] = useState<CallRequest>({
    recipientName: '',
    phoneNumber: '',
    callGoal: '',
    additionalContext: ''
  });
  
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const handleInputChange = (field: keyof CallRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear errors for this field when user starts typing
    if (errors.some(error => error.field === field)) {
      setErrors(prev => prev.filter(error => error.field !== field));
    }
  };

  const handleBlur = (field: keyof CallRequest) => {
    setTouched(prev => new Set(prev).add(field));
    
    // Format phone number on blur
    if (field === 'phoneNumber' && formData.phoneNumber.trim()) {
      const formatted = formatPhoneNumber(formData.phoneNumber);
      setFormData(prev => ({ ...prev, phoneNumber: formatted }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateCallRequest(formData);
    setErrors(validationErrors);
    setTouched(new Set(['recipientName', 'phoneNumber', 'callGoal', 'additionalContext']));
    
    if (validationErrors.length === 0) {
      onSubmit(formData);
    }
  };

  const getFieldError = (field: string) => {
    return errors.find(error => error.field === field);
  };

  const isFieldInvalid = (field: string) => {
    return touched.has(field) && getFieldError(field);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Phone className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Make an AI Call</h2>
        <p className="text-gray-600">Let our AI assistant handle your phone call professionally</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="recipientName" className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4 mr-2" />
            Recipient Name
          </label>
          <input
            type="text"
            id="recipientName"
            value={formData.recipientName}
            onChange={(e) => handleInputChange('recipientName', e.target.value)}
            onBlur={() => handleBlur('recipientName')}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              isFieldInvalid('recipientName') 
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            placeholder="Enter the person or business name"
            disabled={isLoading}
          />
          {isFieldInvalid('recipientName') && (
            <p className="text-red-600 text-sm mt-1">{getFieldError('recipientName')?.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="phoneNumber" className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Phone className="w-4 h-4 mr-2" />
            Phone Number
          </label>
          <input
            type="tel"
            id="phoneNumber"
            value={formData.phoneNumber}
            onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
            onBlur={() => handleBlur('phoneNumber')}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              isFieldInvalid('phoneNumber') 
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            placeholder="+1-555-123-4567"
            disabled={isLoading}
          />
          {isFieldInvalid('phoneNumber') && (
            <p className="text-red-600 text-sm mt-1">{getFieldError('phoneNumber')?.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="callGoal" className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Target className="w-4 h-4 mr-2" />
            Call Goal
          </label>
          <select
            id="callGoal"
            value={formData.callGoal}
            onChange={(e) => handleInputChange('callGoal', e.target.value)}
            onBlur={() => handleBlur('callGoal')}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              isFieldInvalid('callGoal') 
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            disabled={isLoading}
          >
            <option value="">Select call objective</option>
            {CALL_GOALS.map(goal => (
              <option key={goal} value={goal}>{goal}</option>
            ))}
          </select>
          {isFieldInvalid('callGoal') && (
            <p className="text-red-600 text-sm mt-1">{getFieldError('callGoal')?.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="additionalContext" className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <MessageSquare className="w-4 h-4 mr-2" />
            Additional Context <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <textarea
            id="additionalContext"
            value={formData.additionalContext}
            onChange={(e) => handleInputChange('additionalContext', e.target.value)}
            onBlur={() => handleBlur('additionalContext')}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 transition-colors resize-none"
            placeholder="Provide any specific instructions, preferences, or context for the call..."
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 hover:shadow-lg transform hover:-translate-y-0.5'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Initiating Call...
            </div>
          ) : (
            'Make Call'
          )}
        </button>
      </form>
    </div>
  );
}