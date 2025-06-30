# 🚨 Fix Telnyx Connection ID Error

## Problem Identified
The error "Invalid value for connection_id (Call Control App ID)" means your `TELNYX_CONNECTION_ID` is either:
1. Incorrect/invalid
2. Not properly set in Supabase Edge Functions
3. The connection doesn't have a valid webhook URL

## 🔧 Step-by-Step Fix

### Step 1: Get the Correct Connection ID

1. **Go to Telnyx Portal**: https://portal.telnyx.com
2. **Navigate to**: Voice → Connections
3. **Find your connection** (or create a new one):
   - **Connection Type**: Voice API
   - **Connection Name**: "AI Call Assistant"
   - **Webhook URL**: `https://your-project.supabase.co/functions/v1/telnyx-webhook`
   - **Webhook Method**: POST
4. **Copy the Connection ID** - it should look like: `1234567890123456789`

### Step 2: Verify/Create Voice API Connection

If you don't have a Voice API connection:

1. **Click "Create Connection"**
2. **Select**: Voice API (not SIP)
3. **Configure**:
   ```
   Connection Name: AI Call Assistant
   Webhook URL: https://your-project.supabase.co/functions/v1/telnyx-webhook
   Webhook Method: POST
   Timeout: 25 seconds
   ```
4. **Enable Features**:
   - ✅ Outbound calls
   - ✅ Machine detection
   - ✅ Real-time transcription
5. **Save and copy the Connection ID**

### Step 3: Update Supabase Environment Variables

1. **Go to**: Supabase Dashboard → Edge Functions → Settings
2. **Update/Add**:
   ```bash
   TELNYX_CONNECTION_ID=your_correct_connection_id_here
   ```
3. **Verify other variables are set**:
   ```bash
   TELNYX_API_KEY=your_api_key
   TELNYX_PHONE_NUMBER=+351210600099
   OPENAI_API_KEY=your_openai_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### Step 4: Link Phone Number to Connection

1. **Go to**: Numbers → My Numbers
2. **Click on**: +351210600099 (or your number)
3. **Voice Settings**:
   - **Connection**: Select "AI Call Assistant"
   - **Webhook URL**: Should auto-populate
4. **Save Changes**

### Step 5: Test the Configuration

#### Test 1: Verify Connection ID
```bash
curl -X GET "https://api.telnyx.com/v2/connections/YOUR_CONNECTION_ID" \
  -H "Authorization: Bearer YOUR_TELNYX_API_KEY"
```
**Expected**: Should return connection details, not 404

#### Test 2: Test Edge Function
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/telnyx-initiate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{
    "callId": "test-123",
    "phoneNumber": "+1234567890",
    "recipientName": "Test",
    "callGoal": "Test call",
    "additionalContext": ""
  }'
```
**Expected**: Should not return "Invalid connection_id" error

## 🔍 Common Issues & Fixes

### Issue 1: "Connection not found"
**Fix**: The Connection ID is wrong. Get the correct one from Telnyx Portal.

### Issue 2: "Webhook URL invalid"
**Fix**: Ensure webhook URL is exactly: `https://your-project.supabase.co/functions/v1/telnyx-webhook`

### Issue 3: "Connection not authorized"
**Fix**: 
1. Check the connection is active in Telnyx Portal
2. Verify your API key has permissions for this connection

### Issue 4: "Phone number not linked"
**Fix**: Link your phone number to the Voice API connection in Telnyx Portal

## 📋 Verification Checklist

Before testing again:

- [ ] ✅ Voice API connection exists in Telnyx Portal
- [ ] ✅ Connection ID is correct and updated in Supabase
- [ ] ✅ Webhook URL is set in the connection
- [ ] ✅ Phone number is linked to the connection
- [ ] ✅ All environment variables are set in Supabase Edge Functions
- [ ] ✅ API key has proper permissions

## 🎯 Your Exact Configuration

Based on your setup:

1. **Telnyx Portal Configuration**:
   ```
   Connection Type: Voice API
   Connection Name: AI Call Assistant
   Webhook URL: https://your-project.supabase.co/functions/v1/telnyx-webhook
   Phone Number: +351210600099
   ```

2. **Supabase Environment Variables**:
   ```bash
   TELNYX_API_KEY=your_api_key_from_telnyx
   TELNYX_CONNECTION_ID=your_voice_api_connection_id
   TELNYX_PHONE_NUMBER=+351210600099
   ```

## 🚀 Next Steps

1. **Get correct Connection ID** from Telnyx Portal
2. **Update Supabase environment variable**
3. **Wait 2-3 minutes** for propagation
4. **Test call again** in your app

The "Invalid connection_id" error will disappear once you have the correct Voice API Connection ID! 🎉