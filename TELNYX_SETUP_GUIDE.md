# Complete Telnyx Setup Guide

## 🔧 Part 1: Telnyx Dashboard Configuration

### Step 1: Account Setup & API Key
1. **Go to**: https://portal.telnyx.com
2. **Sign up/Login** to your Telnyx account
3. **Navigate to**: API Keys (in left sidebar under "Account")
4. **Create API Key**:
   - Click "Create API Key"
   - Name: "AI Call Assistant"
   - Copy the key immediately (you won't see it again)
   - **Save this as**: `TELNYX_API_KEY`

### Step 2: Purchase/Configure Phone Number
1. **Go to**: Numbers → Phone Numbers → Search & Buy
2. **Purchase a number** (or use existing):
   - Recommended: +351210600099 (Portugal) or US number
   - Ensure it supports **Voice** capabilities
3. **Configure the number**:
   - Go to: Numbers → My Numbers
   - Click on your purchased number
   - **Connection**: We'll set this in Step 3

### Step 3: Create Voice API Connection
1. **Go to**: Voice → Connections
2. **Click**: "Create Connection"
3. **Configure**:
   - **Connection Type**: Voice API
   - **Connection Name**: "AI Call Assistant"
   - **Webhook URL**: `https://your-project.supabase.co/functions/v1/telnyx-webhook`
   - **Webhook Method**: POST
   - **Failover URL**: (leave blank for now)
   - **Timeout**: 25 seconds
   - **Enable Features**:
     - ✅ Outbound calls
     - ✅ Machine detection
     - ✅ Real-time transcription (if available)
     - ✅ DTMF detection
4. **Save Connection**
5. **Copy the Connection ID** from the connection details
   - **Save this as**: `TELNYX_CONNECTION_ID`

### Step 4: Link Phone Number to Connection
1. **Go back to**: Numbers → My Numbers
2. **Click on your phone number**
3. **Voice Settings**:
   - **Connection**: Select "AI Call Assistant" (the connection you just created)
   - **Webhook URL**: Should auto-populate from connection
4. **Save Changes**

### Step 5: Enable International Calling (if needed)
1. **Go to**: Voice → Outbound Voice Profiles
2. **Create/Edit Profile**:
   - **Name**: "International Calling"
   - **Enable countries** you want to call:
     - ✅ United States
     - ✅ Portugal  
     - ✅ Any other countries you need
3. **Apply profile** to your connection

---

## 🔧 Part 2: Supabase Edge Functions Environment Variables

### Required Environment Variables for Edge Functions

Go to your **Supabase Dashboard** → **Edge Functions** → **Settings** and add these:

```bash
# Telnyx Configuration (NEW)
TELNYX_API_KEY=your_telnyx_api_key_from_step_1
TELNYX_CONNECTION_ID=your_connection_id_from_step_3
TELNYX_PHONE_NUMBER=+351210600099

# AI Configuration (UPDATED for GPT-4o)
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
AI_MODEL=gpt-4o
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=150

# Voice Configuration (NEW - AWS Polly)
TTS_ENGINE=aws.polly
TTS_VOICE=Joanna-Neural
VOICE_LANGUAGE=en-US
VOICE_SPEED=1.0

# Transcription Configuration (NEW)
TRANSCRIPTION_MODEL=distil-whisper/distil-large-v2

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_not_anon_key

# Legacy (Optional - for fallback)
ELEVENLABS_API_KEY=your_elevenlabs_key_optional
ELEVENLABS_VOICE_ID=your_voice_id_optional
```

### Step-by-Step Environment Variable Setup:

#### 1. Get Your Telnyx Credentials
- **TELNYX_API_KEY**: From Step 1 above
- **TELNYX_CONNECTION_ID**: From Step 3 above  
- **TELNYX_PHONE_NUMBER**: Your purchased number (e.g., +351210600099)

#### 2. Get Your OpenAI API Key
1. Go to: https://platform.openai.com/api-keys
2. Create new key: "AI Call Assistant"
3. Copy the key
4. **Set as**: `OPENAI_API_KEY`

#### 3. Get Your Supabase Service Role Key
1. Go to: Supabase Dashboard → Settings → API
2. **Copy**: `service_role` key (NOT the anon key)
3. **Set as**: `SUPABASE_SERVICE_ROLE_KEY`

#### 4. Set Your Supabase URL
1. From same page, copy your **Project URL**
2. **Set as**: `SUPABASE_URL`

---

## 🧪 Part 3: Testing Your Configuration

### Test 1: Verify Telnyx Connection
```bash
curl -X GET "https://api.telnyx.com/v2/phone_numbers" \
  -H "Authorization: Bearer YOUR_TELNYX_API_KEY"
```
**Expected**: List of your phone numbers

### Test 2: Verify Edge Functions
1. **Go to your app** → Diagnostics tab
2. **Click**: "Run Full Diagnostics"
3. **Check**: All services show green ✅

### Test 3: Test Webhook Accessibility
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/telnyx-webhook?callId=test-123"
```
**Expected**: "Test OK - Telnyx webhook is accessible"

### Test 4: Make a Test Call
1. **Use your app** to make a test call to your own phone
2. **Monitor**: Supabase Edge Function logs for activity
3. **Check**: Call appears in your app's call history

---

## 🔍 Part 4: Troubleshooting Common Issues

### Issue 1: "Telnyx credentials not configured"
**Fix**: Ensure all three Telnyx environment variables are set in Supabase Edge Functions

### Issue 2: "Call permissions not enabled"
**Fix**: 
1. Go to Telnyx Portal → Voice → Outbound Voice Profiles
2. Enable the target country
3. Apply profile to your connection

### Issue 3: "Webhook not accessible"
**Fix**:
1. Verify webhook URL in Telnyx connection: `https://your-project.supabase.co/functions/v1/telnyx-webhook`
2. Ensure Edge Functions are deployed
3. Check Supabase function logs for errors

### Issue 4: "OpenAI API error"
**Fix**:
1. Verify API key is valid
2. Check you have sufficient credits
3. Ensure you have access to GPT-4o model

### Issue 5: "Call initiated but no conversation"
**Fix**:
1. Check Telnyx webhook is receiving events
2. Verify AI configuration in Edge Functions
3. Monitor Edge Function logs during call

---

## 📋 Part 5: Verification Checklist

Before making your first call, verify:

- [ ] ✅ Telnyx API key is valid and set in Edge Functions
- [ ] ✅ Telnyx connection ID is correct and set
- [ ] ✅ Phone number is purchased and linked to connection
- [ ] ✅ Webhook URL is configured in Telnyx connection
- [ ] ✅ OpenAI API key is valid and has GPT-4o access
- [ ] ✅ Supabase service role key is set (not anon key)
- [ ] ✅ All Edge Functions are deployed
- [ ] ✅ Diagnostics tool shows all green
- [ ] ✅ International calling enabled for target countries

---

## 🎯 Part 6: Your Specific Configuration

Based on your setup, here are your exact values:

```bash
# Your Telnyx Configuration
TELNYX_PHONE_NUMBER=+351210600099
TELNYX_API_KEY=your_api_key_from_telnyx_portal
TELNYX_CONNECTION_ID=your_connection_id_from_voice_connection

# Your AI Pipeline
AI_PROVIDER=openai
AI_MODEL=gpt-4o
TTS_ENGINE=aws.polly
TTS_VOICE=Joanna-Neural
TRANSCRIPTION_MODEL=distil-whisper/distil-large-v2
```

---

## 🚀 Next Steps

1. **Complete Telnyx Dashboard setup** (Steps 1-5)
2. **Set Edge Function environment variables** (all variables listed)
3. **Deploy Edge Functions** (if not already deployed)
4. **Run diagnostics** in your app
5. **Make test call** to verify everything works

The AI features are handled entirely by your Supabase Edge Functions - Telnyx provides the calling infrastructure, and your functions handle the AI conversation, voice synthesis, and transcription.

---

## 📞 Support

If you encounter issues:
1. Check Supabase Edge Function logs
2. Use the Diagnostics tool in your app
3. Verify all environment variables are set correctly
4. Test individual components (API keys, webhooks, etc.)

Your AI pipeline: **Telnyx** (calls) → **Your Edge Functions** (AI processing) → **OpenAI GPT-4o** (conversation) → **AWS Polly** (voice) → **Distil-Whisper** (transcription)