# AI Call Assistant

A modern, professional AI-powered call assistant application built with React, TypeScript, and Tailwind CSS. This application provides a complete interface for managing AI-driven phone calls with real-time status tracking, live conversation monitoring, and comprehensive call history.

## 🚀 Live Demo

**Production URL**: https://loquacious-cucurucho-2b88cb.netlify.app

The application is deployed and ready for use with full AI-powered calling capabilities.

## ✨ Features

### 🎯 Core Functionality
- **Smart Call Forms**: Intuitive form with recipient details, phone validation, and call objectives
- **Real-time Status**: Live call progress tracking with animated status indicators
- **Live Call Monitor**: Real-time conversation interface with AI assistance capabilities
- **Comprehensive Results**: Detailed call outcomes with success/failure messaging and transcripts
- **Call History**: Complete call log with search, filtering, and detailed view options
- **Professional UI**: Modern, responsive design with smooth animations and micro-interactions

### 🤖 AI-Powered Features
- **Intelligent Conversations**: Natural language processing with OpenAI GPT-4 or Claude
- **Portuguese Voice Synthesis**: High-quality voice generation using ElevenLabs
- **Context-Aware Responses**: AI maintains conversation context and call objectives
- **Real-time Assistance**: Human operators can assist AI during live calls
- **Smart Call Completion**: AI determines when objectives are met and ends calls appropriately

### 🔧 Technical Features
- **TypeScript**: Full type safety and enhanced developer experience
- **Real-time Updates**: Live conversation monitoring with Supabase real-time subscriptions
- **Twilio Integration**: Professional phone calling infrastructure
- **Modular Architecture**: Clean separation of concerns across multiple files
- **Error Handling**: Comprehensive error states and user feedback
- **Environment Configuration**: Ready for production deployment

### 📱 User Experience
- **Form Validation**: Real-time phone number validation and error handling
- **Loading States**: Professional loading indicators and progress bars
- **Responsive Design**: Optimized for mobile, tablet, and desktop viewing
- **Accessibility**: Proper contrast ratios, keyboard navigation, and screen reader support
- **Debug Tools**: Development-only diagnostic and testing tools

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript for type-safe component development
- **Tailwind CSS** for modern, responsive styling
- **Vite** for fast development and optimized builds
- **Lucide React** for consistent iconography

### Backend Infrastructure
- **Supabase** for database, real-time subscriptions, and Edge Functions
- **Twilio** for phone calling infrastructure and webhooks
- **OpenAI/Claude** for intelligent conversation AI
- **ElevenLabs** for natural Portuguese voice synthesis

### Database Schema
```sql
-- Call records with comprehensive tracking
CREATE TABLE call_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_name text NOT NULL,
  phone_number text NOT NULL,
  call_goal text NOT NULL,
  additional_context text DEFAULT '',
  status call_status NOT NULL DEFAULT 'preparing',
  result_success boolean,
  result_message text,
  result_details text,
  result_transcript text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration integer DEFAULT 0,
  user_id uuid REFERENCES auth.users(id)
);

-- Custom enum for call status tracking
CREATE TYPE call_status AS ENUM (
  'idle', 'preparing', 'dialing', 'in-progress', 'completed', 'failed'
);
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- Twilio account with phone number
- OpenAI or Claude API access
- ElevenLabs account for voice synthesis

### 1. Clone and Install
```bash
git clone <repository-url>
cd ai-call-assistant
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env` and configure:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Twilio Configuration
VITE_TWILIO_ACCOUNT_SID=your_twilio_account_sid
VITE_TWILIO_AUTH_TOKEN=your_twilio_auth_token
VITE_TWILIO_PHONE_NUMBER=your_twilio_phone_number

# AI Configuration (Choose one)
VITE_AI_PROVIDER=openai  # or "claude"
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_CLAUDE_API_KEY=your_claude_api_key

# ElevenLabs Voice Configuration
VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key
VITE_ELEVENLABS_VOICE_ID=your_portuguese_voice_id

# Development Tools (optional)
VITE_SHOW_DEBUG_TABS=true  # Show debug tools in production
```

### 3. Database Setup
Run the database migration in your Supabase SQL editor:
```sql
-- The migration file creates all necessary tables and policies
-- See supabase/migrations/20250630111010_spring_frost.sql
```

### 4. Supabase Edge Functions Setup
Deploy the Edge Functions with environment variables:

**Required Environment Variables for Edge Functions:**
```bash
# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_phone_number

# AI Provider
AI_PROVIDER=openai  # or "claude"
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
AI_MODEL=gpt-4
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=150

# Voice Synthesis
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 5. Twilio Webhook Configuration
In your Twilio Console, configure your phone number with these webhook URLs:
- **Voice URL**: `https://your-project.supabase.co/functions/v1/twiml-voice`
- **Status Callback**: `https://your-project.supabase.co/functions/v1/twiml-status`

### 6. Start Development
```bash
npm run dev
```

## 📁 Project Structure

```
src/
├── components/              # React components
│   ├── CallForm.tsx        # Call initiation form
│   ├── CallStatus.tsx      # Call status display
│   ├── CallHistory.tsx     # Call history management
│   ├── RealTimeCallInterface.tsx  # Live call monitoring
│   ├── DiagnosticTool.tsx  # System diagnostics
│   ├── WebhookTester.tsx   # Webhook testing
│   ├── DebugPanel.tsx      # Debug information
│   └── ElevenLabsFixGuide.tsx  # Voice setup guide
├── types/                  # TypeScript definitions
│   └── index.ts           # Core interfaces
├── utils/                  # Utility functions
│   ├── realApi.ts         # API integration
│   ├── validation.ts      # Form validation
│   ├── errorHandler.ts    # Error management
│   ├── aiService.ts       # AI integration
│   ├── voiceService.ts    # Voice synthesis
│   └── elevenLabsTest.ts  # Voice testing
├── lib/                   # External service clients
│   └── supabase.ts        # Supabase client
└── App.tsx                # Main application

supabase/
├── functions/             # Edge Functions
│   ├── twilio-initiate/   # Call initiation
│   ├── twiml-voice/       # Voice webhook handler
│   ├── twiml-status/      # Status webhook handler
│   ├── twiml-gather/      # Speech processing
│   ├── ai-conversation/   # AI conversation engine
│   └── twilio-debug/      # Debug utilities
└── migrations/            # Database schema
    └── 20250630111010_spring_frost.sql
```

## 🔧 Configuration Guide

### AI Provider Setup

#### OpenAI Configuration
1. Get API key from https://platform.openai.com/api-keys
2. Set `VITE_AI_PROVIDER=openai`
3. Configure `VITE_OPENAI_API_KEY`
4. Recommended model: `gpt-4`

#### Claude Configuration
1. Get API key from https://console.anthropic.com/
2. Set `VITE_AI_PROVIDER=claude`
3. Configure `VITE_CLAUDE_API_KEY`
4. Recommended model: `claude-3-sonnet-20240229`

### Voice Synthesis Setup

#### ElevenLabs Configuration
1. Create account at https://elevenlabs.io/
2. Get API key from settings
3. Choose a Portuguese voice ID:
   - `pNInz6obpgDQGcFmaJgB` (Adam - Multilingual)
   - `EXAVITQu4vr4xnSDxMaL` (Bella - Multilingual)
   - `VR6AewLTigWG4xSOukaG` (Arnold - Multilingual)

### Twilio Setup
1. Create account at https://twilio.com/
2. Purchase a phone number
3. Configure webhook URLs in phone number settings
4. Enable international calling permissions if needed

## 🚀 Deployment

### Netlify Deployment (Recommended)
The application is optimized for Netlify deployment:

1. **Build Configuration**:
   ```bash
   npm run build
   ```

2. **Environment Variables**: Set all `VITE_*` variables in Netlify dashboard

3. **Deploy**: Connect your repository or use Netlify CLI

### Manual Deployment
1. Build the application: `npm run build`
2. Deploy the `dist` folder to any static hosting service
3. Ensure environment variables are properly configured

## 🔍 Features Deep Dive

### Real-Time Call Monitoring
- Live conversation display with AI and human messages
- Real-time status updates via Supabase subscriptions
- Human assistance interface for complex questions
- Call statistics and duration tracking

### AI Conversation Engine
- Context-aware responses based on call objectives
- Natural conversation flow with proper turn-taking
- Intelligent call completion detection
- Fallback responses for technical issues

### Voice Integration
- High-quality Portuguese voice synthesis
- Natural speech patterns and pronunciation
- Configurable voice settings (speed, pitch, clarity)
- Fallback to browser speech synthesis if needed

### Error Handling & Recovery
- Comprehensive error logging and recovery
- Automatic retry mechanisms with exponential backoff
- Graceful degradation when services are unavailable
- User-friendly error messages and guidance

## 🧪 Testing & Debugging

### Built-in Diagnostic Tools
- **System Diagnostics**: Test all API connections and configurations
- **Webhook Tester**: Verify Twilio webhook functionality
- **Debug Panel**: Monitor call states and troubleshoot issues
- **ElevenLabs Guide**: Step-by-step voice setup assistance

### Development Mode
Set `VITE_SHOW_DEBUG_TABS=true` to enable debug tools in production.

### Testing Checklist
- [ ] Environment variables configured
- [ ] Database migration completed
- [ ] Edge Functions deployed with environment variables
- [ ] Twilio webhooks configured correctly
- [ ] AI provider API key valid
- [ ] ElevenLabs voice synthesis working
- [ ] Test call completes successfully

## 🔒 Security & Privacy

### Data Protection
- Row Level Security (RLS) enabled on all tables
- User-specific data access policies
- Secure API key management
- No sensitive data in client-side code

### Call Privacy
- Optional call recording (disabled by default)
- Transcript storage with user consent
- Secure webhook authentication
- GDPR-compliant data handling

## 📊 Monitoring & Analytics

### Call Metrics
- Success/failure rates
- Average call duration
- Conversation quality metrics
- AI assistance frequency

### System Health
- API response times
- Error rates by service
- Real-time connection status
- Service availability monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with proper TypeScript typing
4. Add tests for new functionality
5. Update documentation as needed
6. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Maintain component modularity (max 300 lines per file)
- Use proper error handling and logging
- Write comprehensive tests for new features
- Update documentation for API changes

## 📝 License

This project is ready for production use and can be customized for your specific requirements.

## 🆘 Support & Troubleshooting

### Common Issues
1. **"Application error occurred"**: Check Twilio webhook URLs and Edge Function deployment
2. **AI not responding**: Verify API keys and provider configuration
3. **Voice synthesis failing**: Check ElevenLabs API key and voice ID
4. **Database connection issues**: Verify Supabase configuration and RLS policies

### Getting Help
- Check the built-in diagnostic tools
- Review the troubleshooting guide in `TROUBLESHOOTING_GUIDE.md`
- Verify all environment variables are set correctly
- Test individual components using the debug panel

### Performance Optimization
- Use real-time subscriptions for live updates
- Implement proper error boundaries
- Cache API responses where appropriate
- Optimize bundle size with code splitting

---

**Built with ❤️ using modern web technologies and AI**

*Ready for production deployment with enterprise-grade features and reliability.*