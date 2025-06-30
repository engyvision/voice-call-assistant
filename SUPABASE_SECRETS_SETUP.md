# Supabase Edge Functions Environment Variables Setup

## 🔑 Required Secrets for Telnyx Integration

You need to set these environment variables in your **Supabase Dashboard** → **Edge Functions** → **Settings**:

### 1. Telnyx Configuration (NEW - Required)
```bash
TELNYX_API_KEY=your_telnyx_api_key_here
TELNYX_CONNECTION_ID=your_telnyx_connection_id_here  
TELNYX_PHONE_NUMBER=+351210600099
```

### 2. AI Configuration (UPDATED)
```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
AI_MODEL=gpt-4o
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=150
```

### 3. Voice & Transcription (NEW)
```bash
TTS_ENGINE=aws.polly
TTS_VOICE=Joanna-Neural
VOICE_LANGUAGE=en-US
TRANSCRIPTION_MODEL=distil-whisper/distil-large-v2
```

### 4. Supabase Configuration
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_not_anon_key
```

## 📋 Step-by-Step Instructions

### Step 1: Access Supabase Edge Functions Settings
1. Go to your **Supabase Dashboard**
2. Navigate to **Edge Functions** (in left sidebar)
3. Click on **Settings** tab
4. Scroll down to **Environment Variables** section

### Step 2: Add Each Variable
For each variable above:
1. Click **Add new variable**
2. Enter the **Name** (e.g., `TELNYX_API_KEY`)
3. Enter the **Value** (your actual API key)
4. Click **Save**

### Step 3: Get Your Telnyx Credentials

#### TELNYX_API_KEY:
1. Go to https://portal.telnyx.com
2. Navigate to **API Keys** (in left sidebar)
3. Create new API key named "AI Call Assistant"
4. Copy the key immediately

#### TELNYX_CONNECTION_ID:
1. In Telnyx Portal, go to **Voice** → **Connections**
2. Create new connection:
   - Type: **Voice API**
   - Name: "AI Call Assistant"
   - Webhook URL: `https://your-project.supabase.co/functions/v1/telnyx-webhook`
3. Copy the **Connection ID** from the connection details

#### TELNYX_PHONE_NUMBER:
1. Go to **Numbers** → **Phone Numbers**
2. Purchase the number: **+351210600099** (or use existing)
3. Link it to your Voice API connection

### Step 4: Get Your OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create new key: "AI Call Assistant"
3. Copy the key
4. Ensure you have access to **GPT-4o** model

### Step 5: Get Your Supabase Service Role Key
1. In Supabase Dashboard → **Settings** → **API**
2. Copy the **service_role** key (NOT the anon key)
3. This key has full database access for Edge Functions

## ⚠️ Important Notes

### Environment Variable Names
- Edge Function variables do **NOT** have the `VITE_` prefix
- Use exactly these names: `TELNYX_API_KEY`, `OPENAI_API_KEY`, etc.

### Security
- **Never** commit these keys to your code
- The service role key is very powerful - keep it secure
- Edge Function environment variables are encrypted

### Deployment
- After adding variables, **redeploy** your Edge Functions
- Variables are available immediately after saving

## 🧪 Verification

### Test 1: Check Variables Are Set
Run this in your browser console on your app:
```javascript
// This will test if your frontend variables are set
console.log('Frontend vars:', {
  telnyx: !!import.meta.env.VITE_TELNYX_API_KEY,
  openai: !!import.meta.env.VITE_OPENAI_API_KEY,
  supabase: !!import.meta.env.VITE_SUPABASE_URL
});
```

### Test 2: Use Diagnostics Tool
1. Go to your app → **Diagnostics** tab
2. Click **Run Full Diagnostics**
3. All services should show ✅ green

### Test 3: Check Edge Function Logs
1. Make a test call
2. Go to Supabase Dashboard → **Edge Functions** → **telnyx-initiate**
3. Check logs for any "Missing environment variable" errors

## 🔧 Troubleshooting

### "Telnyx credentials not configured"
- ✅ Add `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_PHONE_NUMBER`
- ✅ Redeploy Edge Functions
- ✅ Wait 2-3 minutes for propagation

### "OpenAI API error"
- ✅ Add `OPENAI_API_KEY` 
- ✅ Verify you have GPT-4o access
- ✅ Check your OpenAI account has credits

### "Database connection failed"
- ✅ Add `SUPABASE_SERVICE_ROLE_KEY` (not anon key)
- ✅ Verify the key has full permissions

### Edge Functions not updating
- ✅ Redeploy functions after adding variables
- ✅ Check function logs for startup errors
- ✅ Verify variable names exactly match (no typos)

## 📞 Complete Variable List

Copy this checklist and verify each one:

```bash
# Telnyx (Required for calls)
□ TELNYX_API_KEY=key_from_telnyx_portal
□ TELNYX_CONNECTION_ID=connection_id_from_voice_api
□ TELNYX_PHONE_NUMBER=+351210600099

# AI (Required for conversation)
□ AI_PROVIDER=openai
□ OPENAI_API_KEY=key_from_openai_platform
□ AI_MODEL=gpt-4o
□ AI_TEMPERATURE=0.7
□ AI_MAX_TOKENS=150

# Voice & Transcription (New pipeline)
□ TTS_ENGINE=aws.polly
□ TTS_VOICE=Joanna-Neural
□ VOICE_LANGUAGE=en-US
□ TRANSCRIPTION_MODEL=distil-whisper/distil-large-v2

# Supabase (Required for database)
□ SUPABASE_URL=your_project_url
□ SUPABASE_SERVICE_ROLE_KEY=service_role_key_not_anon
```

Once all variables are set and Edge Functions are redeployed, your calls should work! 🎉