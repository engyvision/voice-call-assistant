// ElevenLabs API Testing Utility
export class ElevenLabsTestService {
  private apiKey: string;
  private voiceId: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    this.voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID;
  }

  async testConnection(): Promise<{
    success: boolean;
    error?: string;
    details?: any;
  }> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'ElevenLabs API key not configured'
      };
    }

    try {
      console.log('Testing ElevenLabs connection...');
      
      // Test 1: Check API key validity by fetching voices
      const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });

      console.log('Voices API response status:', voicesResponse.status);

      if (!voicesResponse.ok) {
        const errorText = await voicesResponse.text();
        console.error('Voices API error:', errorText);
        
        if (voicesResponse.status === 401) {
          return {
            success: false,
            error: 'Invalid ElevenLabs API key',
            details: 'The API key is either incorrect or expired'
          };
        }
        
        return {
          success: false,
          error: `ElevenLabs API error: ${voicesResponse.status}`,
          details: errorText
        };
      }

      const voicesData = await voicesResponse.json();
      console.log('Available voices:', voicesData.voices?.length || 0);

      // Test 2: Check if configured voice ID exists
      let voiceExists = false;
      let portugueseVoices = [];
      
      if (voicesData.voices) {
        voiceExists = this.voiceId ? voicesData.voices.some((voice: any) => voice.voice_id === this.voiceId) : false;
        portugueseVoices = voicesData.voices.filter((voice: any) => 
          voice.labels?.language?.includes('Portuguese') || 
          voice.labels?.language?.includes('pt') ||
          voice.name.toLowerCase().includes('portuguese') ||
          voice.name.toLowerCase().includes('brasil')
        );
      }

      // Test 3: Try a simple text-to-speech conversion
      if (this.voiceId && voiceExists) {
        try {
          const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg'
            },
            body: JSON.stringify({
              text: 'Teste de conexão',
              model_id: 'eleven_multilingual_v2',
              voice_settings: {
                stability: 0.75,
                similarity_boost: 0.85
              }
            })
          });

          console.log('TTS test response status:', ttsResponse.status);

          if (ttsResponse.ok) {
            return {
              success: true,
              details: {
                totalVoices: voicesData.voices?.length || 0,
                portugueseVoices: portugueseVoices.length,
                configuredVoiceExists: voiceExists,
                ttsWorking: true
              }
            };
          } else {
            const ttsError = await ttsResponse.text();
            console.error('TTS test error:', ttsError);
            
            return {
              success: false,
              error: 'Text-to-speech test failed',
              details: {
                totalVoices: voicesData.voices?.length || 0,
                portugueseVoices: portugueseVoices.length,
                configuredVoiceExists: voiceExists,
                ttsError: ttsError
              }
            };
          }
        } catch (ttsError) {
          console.error('TTS test exception:', ttsError);
          return {
            success: false,
            error: 'Text-to-speech test failed with network error',
            details: {
              totalVoices: voicesData.voices?.length || 0,
              portugueseVoices: portugueseVoices.length,
              configuredVoiceExists: voiceExists,
              ttsError: ttsError.message
            }
          };
        }
      }

      return {
        success: !this.voiceId || voiceExists,
        error: !voiceExists && this.voiceId ? 'Configured voice ID not found' : undefined,
        details: {
          totalVoices: voicesData.voices?.length || 0,
          portugueseVoices: portugueseVoices.length,
          configuredVoiceExists: voiceExists,
          availablePortugueseVoices: portugueseVoices.map((v: any) => ({
            id: v.voice_id,
            name: v.name,
            language: v.labels?.language
          }))
        }
      };

    } catch (error) {
      console.error('ElevenLabs connection test failed:', error);
      
      // Check if it's a CORS or network issue
      if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
        return {
          success: false,
          error: 'Network connection failed - possible CORS or firewall issue',
          details: {
            suggestion: 'This might be a browser CORS restriction. The API should work from your Edge Functions.',
            errorMessage: error.message
          }
        };
      }

      return {
        success: false,
        error: 'Connection test failed',
        details: error.message
      };
    }
  }

  async getPortugueseVoices(): Promise<any[]> {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      return data.voices.filter((voice: any) => 
        voice.labels?.language?.includes('Portuguese') || 
        voice.labels?.language?.includes('pt') ||
        voice.name.toLowerCase().includes('portuguese') ||
        voice.name.toLowerCase().includes('brasil')
      );
    } catch (error) {
      console.error('Failed to fetch Portuguese voices:', error);
      return [];
    }
  }
}