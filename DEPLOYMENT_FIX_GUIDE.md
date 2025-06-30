# 🚨 URGENT: Fix Telnyx Call Initiation Failure

## Problem Identified
The error shows that the Telnyx Edge Functions are not accessible, which means they either:
1. Haven't been deployed to Supabase
2. Are missing environment variables
3. Have configuration issues

## 🔧 Immediate Fix Steps

### Step 1: Deploy Missing Edge Functions
You need to deploy these Edge Functions to Supabase:

1. **Go to your Supabase Dashboard**
2. **Navigate to Edge Functions**
3. **Deploy these functions:**

#### Deploy telnyx-initiate function:
```bash
# If using Supabase CLI locally:
supabase functions deploy telnyx-initiate

# Or manually create in Supabase Dashboard:
# - Function name: telnyx-initiate
# - Copy code from: supabase/functions/telnyx-initiate/index.ts
```

#### Deploy telnyx-webhook function:
```bash
# If using Supabase CLI locally:
supabase functions deploy telnyx-webhook

# Or manually create in Supabase Dashboard:
# - Function name: telnyx-webhook  
# - Copy code from: supabase/functions/telnyx-webhook/index.ts
```

### Step 2: Set Environment Variables in Supabase
**CRITICAL**: Go to Supabase Dashboard → Edge Functions → Settings and add:

```bash
# Telnyx Configuration (REQUIRED)
TELNYX_API_KEY=your_telnyx_api_key
TELNYX_CONNECTION_ID=your_telnyx_connection_id
TELNYX_PHONE_NUMBER=+351210600099

# AI Configuration (REQUIRED)
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
AI_MODEL=gpt-4o

# Supabase Configuration (REQUIRED)
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 3: Quick Test
After deployment, test the functions:

1. **Test telnyx-initiate:**
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/telnyx-initiate?callId=test-123"
```
**Expected**: Should NOT return 404

2. **Test telnyx-webhook:**
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/telnyx-webhook?callId=test-123"
```
**Expected**: Should return "Test OK"

## 🚀 Alternative: Manual Function Creation

If you can't use CLI, manually create the functions:

### 1. Create telnyx-initiate function:
1. Go to Supabase Dashboard → Edge Functions
2. Click "Create Function"
3. Name: `telnyx-initiate`
4. Copy the entire code from `supabase/functions/telnyx-initiate/index.ts`
5. Deploy

### 2. Create telnyx-webhook function:
1. Click "Create Function" again
2. Name: `telnyx-webhook`
3. Copy the entire code from `supabase/functions/telnyx-webhook/index.ts`
4. Deploy

## 🧪 Verification Steps

### 1. Check Function Deployment
- Go to Supabase Dashboard → Edge Functions
- You should see: `telnyx-initiate` and `telnyx-webhook` listed
- Both should show "Deployed" status

### 2. Check Environment Variables
- Go to Edge Functions → Settings
- Verify all required variables are set
- No variables should be empty

### 3. Test in Your App
- Use the Diagnostics tool in your app
- Click "Run Full Diagnostics"
- All services should show ✅

### 4. Make Test Call
- Try making a call to your own phone number
- Monitor Supabase Edge Function logs for activity

## 🔍 Debug Information

### Check Function Logs
1. Go to Supabase Dashboard → Edge Functions
2. Click on `telnyx-initiate`
3. Check logs for errors like:
   - "Missing environment variable"
   - "Telnyx credentials not configured"
   - Any other error messages

### Common Error Messages and Fixes:

#### "Function not found" (404)
- **Fix**: Deploy the missing Edge Functions

#### "Telnyx credentials not configured"
- **Fix**: Add TELNYX_API_KEY, TELNYX_CONNECTION_ID, TELNYX_PHONE_NUMBER

#### "OpenAI API error"
- **Fix**: Add OPENAI_API_KEY and verify it's valid

#### "Database connection failed"
- **Fix**: Add SUPABASE_SERVICE_ROLE_KEY (not anon key)

## 📞 Your Specific Configuration

Based on your setup, you need these exact values:

```bash
# Your Telnyx Phone Number
TELNYX_PHONE_NUMBER=+351210600099

# Get these from Telnyx Portal:
TELNYX_API_KEY=your_api_key_from_telnyx_dashboard
TELNYX_CONNECTION_ID=your_connection_id_from_voice_api_connection

# Get this from OpenAI:
OPENAI_API_KEY=your_openai_api_key

# Get these from Supabase:
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## ⚡ Quick Fix Summary

1. **Deploy Edge Functions** (telnyx-initiate, telnyx-webhook)
2. **Set environment variables** in Supabase Edge Functions settings
3. **Wait 2-3 minutes** for propagation
4. **Test again** using your app

The error you're seeing means the Edge Functions aren't deployed yet. Once deployed with proper environment variables, your calls should work immediately! 🎉