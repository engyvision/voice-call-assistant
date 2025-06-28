export interface ValidationError {
  field: string;
  message: string;
}

export function validatePhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Check if it's a valid US phone number (10 digits) or international (7-15 digits)
  return cleaned.length >= 7 && cleaned.length <= 15;
}

export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format as US phone number if 10 digits
  if (cleaned.length === 10) {
    return `+1-${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // For international numbers, just add + prefix if not present
  if (phone.startsWith('+')) {
    return phone;
  }
  
  return `+${cleaned}`;
}

export function validateCallRequest(request: {
  recipientName: string;
  phoneNumber: string;
  callGoal: string;
  additionalContext: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!request.recipientName.trim()) {
    errors.push({ field: 'recipientName', message: 'Recipient name is required' });
  }
  
  if (!request.phoneNumber.trim()) {
    errors.push({ field: 'phoneNumber', message: 'Phone number is required' });
  } else if (!validatePhoneNumber(request.phoneNumber)) {
    errors.push({ field: 'phoneNumber', message: 'Please enter a valid phone number' });
  }
  
  if (!request.callGoal.trim()) {
    errors.push({ field: 'callGoal', message: 'Call goal is required' });
  }
  
  return errors;
}