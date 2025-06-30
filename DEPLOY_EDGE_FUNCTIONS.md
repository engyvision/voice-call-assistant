# 🚀 Manual Edge Function Deployment Guide

## Problem
The error "Supabase project not connected" occurs because you're in a WebContainer environment where the Supabase CLI is not available.

## ✅ Solution: Deploy via Supabase Dashboard

### Step 1: Access Your Supabase Dashboard
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Edge Functions** in the left sidebar

### Step 2: Deploy telnyx-initiate Function

1. **Click "Create Function"**
2. **Function Name:** `telnyx-initiate`
3. **Copy the code from:** `supabase/functions/telnyx-initiate/index.ts`
4. **Paste it into the editor**
5. **Click "Deploy Function"**

### Step 3: Deploy telnyx-webhook Function

1. **Click "Create Function"**
2. **Function Name:** `telnyx-webhook`
3. **Copy the code from:** `supabase/functions/telnyx-webhook/index.ts`
4. **Paste it into the editor**
5. **Click "Deploy Function"**

### Step 4: Set Environment Variables

Go to **Edge Functions** → **Settings** and add these environment variables:

```bash
# Telnyx Configuration
TELNYX_API_KEY=your_telnyx_api_key
TELNYX_CONNECTION_ID=your_telnyx_connection_id
TELNYX_PHONE_NUMBER=+351210600099

# AI Configuration
OPENAI_API_KEY=your_openai_api_key

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 5: Test the Deployment

1. Use your app's **Diagnostics** tool
2. Check that both functions show as accessible
3. Make a test call to verify everything works

## Alternative: Use Supabase CLI Locally (if possible)

If you have a local development environment with Docker:

```bash
# Initialize Supabase locally
supabase init

# Start local Supabase
supabase start

# Deploy functions
supabase functions deploy telnyx-initiate
supabase functions deploy telnyx-webhook
```

## Verification

After deployment, your functions should be accessible at:
- `https://your-project.supabase.co/functions/v1/telnyx-initiate`
- `https://your-project.supabase.co/functions/v1/telnyx-webhook`

## Next Steps

1. **Deploy both functions** via the dashboard
2. **Set environment variables** in Edge Functions settings
3. **Test with diagnostics** tool in your app
4. **Make a test call** to verify the complete flow works

The manual deployment approach is the recommended solution for WebContainer environments like Bolt.new.