import { ErrorLog } from '../types';

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLogs: ErrorLog[] = [];
  private maxRetries = 3;
  private retryDelays = [1000, 2000, 4000]; // Exponential backoff

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  logError(
    type: ErrorLog['type'],
    message: string,
    details?: string,
    recovered: boolean = false,
    recoveryAction?: string
  ): void {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
      recovered,
      recovery_action: recoveryAction
    };

    this.errorLogs.push(errorLog);
    console.error('Error logged:', errorLog);

    // Keep only last 100 errors to prevent memory issues
    if (this.errorLogs.length > 100) {
      this.errorLogs = this.errorLogs.slice(-100);
    }
  }

  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    errorType: ErrorLog['type'],
    operationName: string
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 0) {
          this.logError(
            errorType,
            `${operationName} succeeded after ${attempt} retries`,
            undefined,
            true,
            `Retry attempt ${attempt}`
          );
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.maxRetries) {
          this.logError(
            errorType,
            `${operationName} failed after ${this.maxRetries} retries`,
            lastError.message,
            false
          );
          break;
        }

        const delay = this.retryDelays[attempt] || 4000;
        this.logError(
          errorType,
          `${operationName} failed, retrying in ${delay}ms`,
          lastError.message,
          false,
          `Retry ${attempt + 1}/${this.maxRetries}`
        );

        await this.delay(delay);
      }
    }

    throw lastError;
  }

  async handleNetworkError<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    operationName: string = 'Network operation'
  ): Promise<T> {
    try {
      return await this.retryWithBackoff(operation, 'network', operationName);
    } catch (error) {
      if (fallback) {
        this.logError(
          'network',
          `${operationName} failed, using fallback`,
          error.message,
          true,
          'Fallback operation'
        );
        return await fallback();
      }
      throw error;
    }
  }

  async handleAPIError<T>(
    operation: () => Promise<T>,
    apiName: string,
    fallback?: () => Promise<T>
  ): Promise<T> {
    try {
      return await this.retryWithBackoff(operation, 'api', `${apiName} API call`);
    } catch (error) {
      const errorMessage = error.message.toLowerCase();
      
      // Handle specific API errors
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        this.logError(
          'api',
          `${apiName} rate limit exceeded`,
          error.message,
          false,
          'Exponential backoff applied'
        );
        
        // Additional delay for rate limiting
        await this.delay(10000);
        throw error;
      }
      
      if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
        this.logError(
          'api',
          `${apiName} authentication failed`,
          error.message,
          false,
          'Check API credentials'
        );
        throw error;
      }
      
      if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
        this.logError(
          'api',
          `${apiName} quota exceeded`,
          error.message,
          false,
          'Check billing and usage limits'
        );
        throw error;
      }

      if (fallback) {
        this.logError(
          'api',
          `${apiName} failed, using fallback`,
          error.message,
          true,
          'Fallback operation'
        );
        return await fallback();
      }

      throw error;
    }
  }

  handleTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName: string = 'Operation'
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          this.logError(
            'timeout',
            `${operationName} timed out after ${timeoutMs}ms`,
            undefined,
            false,
            'Operation cancelled'
          );
          reject(new Error(`${operationName} timeout`));
        }, timeoutMs);
      })
    ]);
  }

  getErrorLogs(): ErrorLog[] {
    return [...this.errorLogs];
  }

  getErrorSummary(): {
    total: number;
    byType: Record<string, number>;
    recovered: number;
    recent: ErrorLog[];
  } {
    const byType: Record<string, number> = {};
    let recovered = 0;

    this.errorLogs.forEach(log => {
      byType[log.type] = (byType[log.type] || 0) + 1;
      if (log.recovered) recovered++;
    });

    // Get errors from last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const recent = this.errorLogs.filter(log => log.timestamp > fiveMinutesAgo);

    return {
      total: this.errorLogs.length,
      byType,
      recovered,
      recent
    };
  }

  clearErrorLogs(): void {
    this.errorLogs = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Generate user-friendly error messages
  getUserFriendlyMessage(error: ErrorLog): string {
    switch (error.type) {
      case 'network':
        return 'Problema de conexão com a internet. Tentando novamente...';
      case 'api':
        if (error.message.includes('rate limit')) {
          return 'Muitas solicitações. Aguardando um momento...';
        }
        if (error.message.includes('unauthorized')) {
          return 'Problema de autenticação. Verifique as configurações.';
        }
        return 'Problema com o serviço externo. Tentando novamente...';
      case 'voice':
        return 'Problema com a síntese de voz. Usando voz alternativa...';
      case 'ai':
        return 'Problema com a IA. Usando resposta padrão...';
      case 'timeout':
        return 'Operação demorou muito. Tentando novamente...';
      default:
        return 'Problema técnico temporário. Tentando resolver...';
    }
  }

  // Check if system is healthy
  isSystemHealthy(): boolean {
    const recentErrors = this.getErrorSummary().recent;
    const criticalErrors = recentErrors.filter(error => 
      !error.recovered && 
      ['api', 'network'].includes(error.type)
    );
    
    // System is unhealthy if more than 3 unrecovered critical errors in last 5 minutes
    return criticalErrors.length <= 3;
  }
}