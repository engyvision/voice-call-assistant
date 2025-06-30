# 🚨 Call System Not Working - Troubleshooting Guide

## Quick Diagnosis Steps

### Step 1: Check if Edge Functions are Deployed
1. Go to your **Supabase Dashboard** → **Edge Functions**
2. Verify you see both functions:
   - ✅ `telnyx-initiate`
   - ✅ `telnyx-webhook`
3. If missing, deploy them manually using the dashboard

### Step 2: Verify Environment Variables
Go to **Edge Functions** → **Settings** and ensure these are set:

```bash
# Critical Variables
TELNYX_API_KEY=your_telnyx_api_key
TELNYX_CONNECTION_ID=your_telnyx_connection_id  
TELNYX_PHONE_NUMBER=+351210600099
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 3: Test Function Accessibility
Run this in your browser console:

```javascript
// Test telnyx-initiate function
fetch('https://your-project.supabase.co/functions/v1/telnyx-initiate?callId=test-123')
  .then(r => console.log('telnyx-initiate status:', r.status))
  .catch(e => console.error('telnyx-initiate error:', e));

// Test telnyx-webhook function  
fetch('https://your-project.supabase.co/functions/v1/telnyx-webhook?callId=test-123')
  .then(r => console.log('telnyx-webhook status:', r.status))
  .catch(e => console.error('telnyx-webhook error:', e));
```

**Expected Results:**
- Status 200 or 400 = Function accessible ✅
- Status 404 = Function not deployed ❌
- Network error = Function not accessible ❌

### Step 4: Check Your App's Diagnostics
1. Go to your app → **Diagnostics** tab
2. Click **"Run Full Diagnostics"**
3. Look for any red ❌ indicators

### Step 5: Verify Telnyx Configuration
1. Go to [Telnyx Portal](https://portal.telnyx.com)
2. Check **Voice** → **Connections**
3. Verify your connection has:
   - **Webhook URL**: `https://your-project.supabase.co/functions/v1/telnyx-webhook`
   - **Status**: Active

## Most Likely Issues & Fixes

### Issue 1: Edge Functions Not Deployed
**Symptoms**: App shows "Failed to initiate call" immediately
**Fix**: 
1. Go to Supabase Dashboard → Edge Functions
2. Manually create and deploy both functions
3. Copy code from your project files

### Issue 2: Missing Environment Variables
**Symptoms**: Functions exist but calls fail with credential errors
**Fix**:
1. Go to Edge Functions → Settings
2. Add all required environment variables
3. Wait 2-3 minutes for propagation

### Issue 3: Telnyx Webhook URL Changed
**Symptoms**: Calls initiate but no conversation happens
**Fix**:
1. Go to Telnyx Portal → Voice → Connections
2. Update webhook URL to match your current Supabase project
3. Ensure it ends with `/functions/v1/telnyx-webhook`

### Issue 4: Database Schema Issues
**Symptoms**: Functions work but call records aren't created/updated
**Fix**:
1. Check if `call_records` table exists in Supabase
2. Verify RLS policies allow function access
3. Check service role key is set correctly

### Issue 5: API Key Expiration
**Symptoms**: Worked before, now fails with authentication errors
**Fix**:
1. Check Telnyx API key is still valid
2. Verify OpenAI API key hasn't expired
3. Ensure sufficient credits in both accounts

## Emergency Quick Fix

If you need calls working immediately:

1. **Redeploy Functions**:
   - Go to Supabase Dashboard
   - Delete existing functions
   - Create new ones with updated code

2. **Reset Environment Variables**:
   - Clear all variables in Edge Functions settings
   - Re-add them one by one
   - Wait 5 minutes between changes

3. **Test with Simple Call**:
   - Use your own phone number
   - Monitor Supabase function logs in real-time
   - Check for specific error messages

## Debug Commands

Run these in your browser console to get detailed info:

```javascript
// Check if your frontend can reach Supabase
fetch(import.meta.env.VITE_SUPABASE_URL + '/rest/v1/call_records?select=count', {
  headers: {
    'Authorization': 'Bearer ' + import.meta.env.VITE_SUPABASE_ANON_KEY,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
  }
}).then(r => console.log('Supabase DB status:', r.status));

// Check environment variables
console.log('Frontend env check:', {
  supabase: !!import.meta.env.VITE_SUPABASE_URL,
  telnyx: !!import.meta.env.VITE_TELNYX_API_KEY,
  openai: !!import.meta.env.VITE_OPENAI_API_KEY
});
```

## What Changed Recently?

Since it "always worked until now", something changed. Check:

1. **Supabase Project**: Did you switch projects or regenerate keys?
2. **Environment Variables**: Were any .env files modified?
3. **Telnyx Account**: Any changes to phone numbers or connections?
4. **API Keys**: Did any expire or get regenerated?
5. **Edge Functions**: Were they redeployed or modified?

## Next Steps

1. **Start with Step 1** - verify functions are deployed
2. **Check environment variables** - most common issue
3. **Test with diagnostics tool** - built into your app
4. **Monitor function logs** - check Supabase Edge Function logs during a test call
5. **Contact support** if all else fails - Telnyx or Supabase support with specific error logs

The most likely cause is that your Edge Functions aren't properly deployed or are missing environment variables after the recent deployment attempts.