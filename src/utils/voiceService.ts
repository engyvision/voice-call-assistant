import { ErrorLog } from '../types';

export interface VoiceResponse {
  audioUrl?: string;
  audioData?: ArrayBuffer;
  duration?: number;
  success: boolean;
  error?: string;
}

export class VoiceService {
  private apiKey: string;
  private voiceId: string;
  private language: string;
  private speed: number;
  private pitch: number;
  private clarity: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    this.voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID;
    this.language = import.meta.env.VITE_VOICE_LANGUAGE || 'pt-BR';
    this.speed = parseFloat(import.meta.env.VITE_VOICE_SPEED) || 1.0;
    this.pitch = parseFloat(import.meta.env.VITE_VOICE_PITCH) || 0.0;
    this.clarity = import.meta.env.VITE_VOICE_CLARITY || 'high';

    if (!this.apiKey || !this.voiceId) {
      throw new Error('Missing ElevenLabs API key or Voice ID');
    }
  }

  async synthesizeSpeech(
    text: string,
    retryCount: number = 0
  ): Promise<VoiceResponse> {
    try {
      console.log('Synthesizing speech:', { text, voiceId: this.voiceId, language: this.language });

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: this.cleanTextForSpeech(text),
          model_id: 'eleven_multilingual_v2', // Best model for Portuguese
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.85,
            style: 0.2,
            use_speaker_boost: true,
            speaking_rate: this.speed,
            pitch: this.pitch
          },
          pronunciation_dictionary_locators: [
            {
              pronunciation_dictionary_id: "portuguese_dict",
              version_id: "latest"
            }
          ],
          language_code: this.language
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', errorText);
        
        // Handle rate limiting with exponential backoff
        if (response.status === 429 && retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.log(`Rate limited, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.synthesizeSpeech(text, retryCount + 1);
        }
        
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioData = await response.arrayBuffer();
      
      // Create a blob URL for the audio
      const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      return {
        audioUrl,
        audioData,
        duration: this.estimateAudioDuration(text),
        success: true
      };

    } catch (error) {
      console.error('Voice synthesis error:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  private cleanTextForSpeech(text: string): string {
    return text
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      // Fix common abbreviations for Portuguese
      .replace(/\bDr\./g, 'Doutor')
      .replace(/\bDra\./g, 'Doutora')
      .replace(/\bSr\./g, 'Senhor')
      .replace(/\bSra\./g, 'Senhora')
      // Ensure proper punctuation for natural speech
      .replace(/([.!?])\s*$/, '$1')
      // Add pause for better speech flow
      .replace(/([.!?])\s+/g, '$1 ')
      .trim();
  }

  private estimateAudioDuration(text: string): number {
    // Estimate based on Portuguese speaking rate (approximately 150-180 words per minute)
    const words = text.split(/\s+/).length;
    const wordsPerMinute = 165; // Average for Portuguese
    const durationMinutes = words / wordsPerMinute;
    return Math.ceil(durationMinutes * 60); // Convert to seconds
  }

  async getAvailableVoices(): Promise<any[]> {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`);
      }

      const data = await response.json();
      
      // Filter for Portuguese voices
      return data.voices.filter((voice: any) => 
        voice.labels?.language?.includes('Portuguese') ||
        voice.labels?.language?.includes('pt') ||
        voice.name.toLowerCase().includes('portuguese') ||
        voice.name.toLowerCase().includes('brasil')
      );

    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }

  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.apiKey) {
      errors.push('ElevenLabs API key is missing');
    }

    if (!this.voiceId) {
      errors.push('ElevenLabs Voice ID is missing');
    }

    if (this.speed < 0.25 || this.speed > 4.0) {
      errors.push('Voice speed must be between 0.25 and 4.0');
    }

    if (this.pitch < -1.0 || this.pitch > 1.0) {
      errors.push('Voice pitch must be between -1.0 and 1.0');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Create fallback TTS using browser's Speech Synthesis API
  async fallbackSynthesis(text: string): Promise<VoiceResponse> {
    return new Promise((resolve) => {
      try {
        if (!('speechSynthesis' in window)) {
          resolve({
            success: false,
            error: 'Speech synthesis not supported in this browser'
          });
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Try to find a Portuguese voice
        const voices = speechSynthesis.getVoices();
        const portugueseVoice = voices.find(voice => 
          voice.lang.startsWith('pt') || 
          voice.name.toLowerCase().includes('portuguese')
        );

        if (portugueseVoice) {
          utterance.voice = portugueseVoice;
          utterance.lang = 'pt-BR';
        }

        utterance.rate = this.speed;
        utterance.pitch = 1.0 + this.pitch;
        utterance.volume = 1.0;

        utterance.onend = () => {
          resolve({
            success: true,
            duration: this.estimateAudioDuration(text)
          });
        };

        utterance.onerror = (event) => {
          resolve({
            success: false,
            error: `Speech synthesis error: ${event.error}`
          });
        };

        speechSynthesis.speak(utterance);

      } catch (error) {
        resolve({
          success: false,
          error: error.message
        });
      }
    });
  }
}