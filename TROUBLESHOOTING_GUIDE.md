# Phone Call System Troubleshooting Guide

## 🚨 Current Issue Analysis

Based on your symptoms:
- ✅ Call initiation works (logs appear in twilio-initiate function)
- ❌ Twilio says "application error occurred" 
- ❌ No logs in twiml-voice, twiml-status, or twiml-gather functions
- ❌ Webhook tests show 401 errors
- ❌ AI doesn't respond intelligently to user input

**Root Cause**: The TwiML webhook functions are missing proper AI integration and environment variables.

---

## 📋 Step-by-Step Troubleshooting

### Step 1: Verify Environment Variables in Supabase Edge Functions

1. **Go to Supabase Dashboard** → Your Project → Edge Functions → Settings
2. **Check these environment variables are set:**

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number

# AI Configuration (Choose ONE)
AI_PROVIDER=openai  # or "claude"
OPENAI_API_KEY=your_openai_key  # if using OpenAI
CLAUDE_API_KEY=your_claude_key  # if using Claude
AI_MODEL=gpt-4  # or claude-3-sonnet-20240229
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=150

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_portuguese_voice_id

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

3. **If any are missing, add them and redeploy all functions**

### Step 2: Test AI Service Configuration

1. **Open your browser's developer console**
2. **Run this test in the console:**

```javascript
// Test OpenAI API
fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_OPENAI_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Test' }],
    max_tokens: 10
  })
}).then(r => r.json()).then(console.log);
```

**Expected Result**: Should return a valid response, not 401/403 errors.

### Step 3: Test ElevenLabs Voice Configuration

1. **Test ElevenLabs API:**

```javascript
// Test ElevenLabs API
fetch('https://api.elevenlabs.io/v1/voices', {
  headers: {
    'Authorization': 'Bearer YOUR_ELEVENLABS_KEY'
  }
}).then(r => r.json()).then(console.log);
```

2. **Verify your voice ID exists in the response**
3. **Test Portuguese voice synthesis:**

```javascript
// Test Portuguese voice synthesis
fetch(`https://api.elevenlabs.io/v1/text-to-speech/YOUR_VOICE_ID`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_ELEVENLABS_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: 'Olá, este é um teste de voz em português.',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.75,
      similarity_boost: 0.85
    }
  })
}).then(r => console.log('Status:', r.status));
```

### Step 4: Check Supabase Function Logs

1. **Go to Supabase Dashboard** → Edge Functions → Functions
2. **Click on each function and check logs:**
   - `twiml-voice`
   - `twiml-status` 
   - `twiml-gather`
   - `twilio-initiate`

3. **Look for these error patterns:**
   - `Missing environment variable`
   - `API key invalid`
   - `Rate limit exceeded`
   - `Network timeout`

### Step 5: Test Individual Webhook Functions

1. **Use the Debug Panel in your app**
2. **Or test manually with curl:**

```bash
# Test twiml-voice function
curl -X POST "YOUR_SUPABASE_URL/functions/v1/twiml-voice?callId=test-123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: TwilioProxy/1.1" \
  -d "CallSid=test&CallStatus=in-progress&From=%2B15551234567&To=%2B15559876543"

# Test twiml-gather function  
curl -X POST "YOUR_SUPABASE_URL/functions/v1/twiml-gather?callId=test-123" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: TwilioProxy/1.1" \
  -d "CallSid=test&SpeechResult=Hello&Confidence=0.95"
```

**Expected Result**: Should return TwiML XML, not error messages.

### Step 6: Verify Twilio Webhook Configuration

1. **Go to Twilio Console** → Phone Numbers → Manage → Active Numbers
2. **Click your phone number**
3. **Verify these webhook URLs are EXACTLY:**
   - **Voice URL**: `YOUR_SUPABASE_URL/functions/v1/twiml-voice`
   - **Status Callback URL**: `YOUR_SUPABASE_URL/functions/v1/twiml-status`
4. **Set HTTP method to POST for both**
5. **Save configuration**

### Step 7: Test End-to-End Call Flow

1. **Make a test call to your own phone number**
2. **Monitor logs in real-time:**
   - Supabase Edge Functions logs
   - Twilio Console → Monitor → Logs
3. **Check the exact error messages**

---

## 🔧 Common Issues and Fixes

### Issue 1: "Missing authorization header" (401 errors)

**Cause**: Environment variables not set in Edge Functions
**Fix**: 
1. Add all required environment variables to Supabase Edge Functions
2. Redeploy all functions
3. Wait 2-3 minutes for propagation

### Issue 2: AI API Failures

**Symptoms**: Functions return generic error responses
**Fixes**:
- **OpenAI**: Verify API key has sufficient credits and correct permissions
- **Claude**: Ensure you have access to Claude API (requires approval)
- **Rate Limits**: Implement exponential backoff in error handling

### Issue 3: ElevenLabs Voice Failures

**Symptoms**: TwiML returns but voice sounds robotic or fails
**Fixes**:
- Verify ElevenLabs API key is valid
- Check voice ID exists and supports Portuguese
- Ensure sufficient ElevenLabs credits
- Test with `eleven_multilingual_v2` model

### Issue 4: Webhook URL Issues

**Symptoms**: Twilio can't reach webhooks
**Fixes**:
- Ensure URLs don't have trailing slashes
- Verify HTTPS (not HTTP)
- Check Supabase project URL is correct
- Test webhook accessibility from external tools

### Issue 5: Database Connection Issues

**Symptoms**: Functions can't read/write call records
**Fixes**:
- Verify `SUPABASE_SERVICE_ROLE_KEY` (not anon key) is set
- Check RLS policies allow function access
- Ensure database migration completed successfully

### Issue 6: AI Not Responding Intelligently

**Symptoms**: Dialer keeps asking for information without understanding responses
**Fixes**:
- Verify AI_PROVIDER is set to 'openai' or 'claude'
- Check OPENAI_API_KEY or CLAUDE_API_KEY is valid
- Ensure twiml-gather function has AI integration
- Test AI API directly to verify it's working
- Check function logs for AI processing errors

---

## 🧪 Quick Diagnostic Tests

### Test 1: Minimal TwiML Response
Create a simple test to verify basic webhook functionality:

```bash
curl -X POST "YOUR_SUPABASE_URL/functions/v1/twiml-voice?callId=test-minimal" \
  -H "User-Agent: TwilioProxy/1.1"
```

**Expected**: XML response with `<Say>` element

### Test 2: Database Connectivity
```bash
curl -X GET "YOUR_SUPABASE_URL/functions/v1/twilio-debug?action=recent_calls" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"
```

**Expected**: JSON with call records

### Test 3: AI Service Health
Check if AI services are responding:
- OpenAI Status: https://status.openai.com/
- Anthropic Status: https://status.anthropic.com/
- ElevenLabs Status: https://status.elevenlabs.io/

### Test 4: AI Integration Test
```bash
curl -X POST "YOUR_SUPABASE_URL/functions/v1/twiml-gather?callId=test-ai" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "User-Agent: TwilioProxy/1.1" \
  -d "CallSid=test&SpeechResult=Yes I can help you&Confidence=0.95"
```

**Expected**: TwiML with intelligent AI response, not generic message

---

## 📞 Emergency Fallback Configuration

If AI/Voice services are down, implement a basic fallback:

1. **Modify twiml-voice function** to return simple TwiML without AI
2. **Use basic rule-based responses** instead of AI generation
3. **Use Twilio's built-in voices** instead of ElevenLabs

---

## 🔍 Monitoring and Logging

### Enable Detailed Logging
Add these console.log statements to your functions:

```javascript
console.log('Environment check:', {
  hasOpenAI: !!Deno.env.get('OPENAI_API_KEY'),
  hasElevenLabs: !!Deno.env.get('ELEVENLABS_API_KEY'),
  hasSupabase: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  aiProvider: Deno.env.get('AI_PROVIDER')
});
```

### Monitor Key Metrics
- Function execution time
- API response times
- Error rates by service
- Call completion rates
- AI response quality

---

## ✅ Success Indicators

You'll know the system is working when:
1. ✅ Webhook tests return 200 status codes
2. ✅ Function logs show successful AI/Voice API calls
3. ✅ Test calls connect and AI responds naturally to user input
4. ✅ Call records update with intelligent conversation transcripts
5. ✅ No "application error occurred" messages
6. ✅ AI understands context and maintains conversation flow

---

## 🆘 If All Else Fails

1. **Check service status pages** for outages
2. **Try different AI/Voice providers** as fallback
3. **Simplify the call flow** to isolate issues
4. **Contact Twilio support** with specific error logs
5. **Review recent changes** to environment variables or code
6. **Use the Diagnostics tool** in the app to test all services

Remember: The "application error occurred" message from Twilio usually means your webhook returned an error or invalid TwiML. Focus on getting the webhook functions to return valid XML responses with proper AI integration first.

## 🤖 AI Integration Checklist

For intelligent conversation, ensure:
- [ ] AI_PROVIDER environment variable is set
- [ ] Valid API key for chosen provider (OpenAI or Claude)
- [ ] twiml-voice generates AI-powered opening messages
- [ ] twiml-gather processes user speech with AI
- [ ] Conversation history is maintained in database
- [ ] AI responses are contextually appropriate
- [ ] Error handling falls back to rule-based responses