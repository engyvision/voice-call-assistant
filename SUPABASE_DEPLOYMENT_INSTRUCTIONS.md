# 🚀 Supabase Edge Function Deployment Instructions

## ⚠️ Important: Manual Deployment Required

Since we're in a WebContainer environment, the Supabase CLI is not available. You need to manually deploy the Edge Functions through the Supabase Dashboard.

## 📋 Step-by-Step Deployment Process

### Step 1: Access Your Supabase Dashboard
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in to your account
3. Select your project

### Step 2: Navigate to Edge Functions
1. In the left sidebar, click on **"Edge Functions"**
2. You should see the Edge Functions management interface

### Step 3: Deploy telnyx-webhook Function
1. Click **"Create Function"** or **"New Function"**
2. Set the function name as: `telnyx-webhook`
3. Copy the entire code from the file `supabase/functions/telnyx-webhook/index.ts`
4. Paste it into the function editor
5. Click **"Deploy"** or **"Save"**

### Step 4: Deploy telnyx-initiate Function (if needed)
1. Click **"Create Function"** again
2. Set the function name as: `telnyx-initiate`
3. Copy the entire code from the file `supabase/functions/telnyx-initiate/index.ts`
4. Paste it into the function editor
5. Click **"Deploy"** or **"Save"**

### Step 5: Configure Environment Variables
1. In the Edge Functions section, look for **"Settings"** or **"Environment Variables"**
2. Add the following required variables:

```
TELNYX_API_KEY=your_telnyx_api_key_here
TELNYX_CONNECTION_ID=your_telnyx_connection_id_here
TELNYX_PHONE_NUMBER=+351210600099
OPENAI_API_KEY=your_openai_api_key_here
AI_PROVIDER=openai
AI_MODEL=gpt-4o
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 6: Verify Deployment
1. After deployment, you should see both functions listed in your Edge Functions dashboard
2. Each function should show a "Deployed" or "Active" status
3. Note the function URLs - they should be in the format:
   - `https://your-project-id.supabase.co/functions/v1/telnyx-webhook`
   - `https://your-project-id.supabase.co/functions/v1/telnyx-initiate`

## 🧪 Test Your Deployment

### Quick Test Commands
You can test if the functions are accessible by running these in your browser's console or using a tool like Postman:

```javascript
// Test telnyx-webhook
fetch('https://your-project-id.supabase.co/functions/v1/telnyx-webhook?callId=test-123')
  .then(response => response.text())
  .then(data => console.log('Webhook test:', data));

// Test telnyx-initiate  
fetch('https://your-project-id.supabase.co/functions/v1/telnyx-initiate?callId=test-123')
  .then(response => response.text())
  .then(data => console.log('Initiate test:', data));
```

### Expected Results
- **telnyx-webhook**: Should return "Test OK - Telnyx webhook is accessible"
- **telnyx-initiate**: Should NOT return a 404 error

## 🔧 Troubleshooting

### If Functions Don't Deploy:
1. Check that you copied the entire code content
2. Ensure there are no syntax errors in the code
3. Verify your Supabase project has Edge Functions enabled

### If Environment Variables Don't Work:
1. Double-check all variable names are exactly as shown
2. Ensure no extra spaces in variable names or values
3. Verify your API keys are valid and active

### If Functions Return Errors:
1. Check the function logs in the Supabase Dashboard
2. Verify all required environment variables are set
3. Test your API keys independently

## ✅ Success Indicators

Once successfully deployed, you should be able to:
1. See both functions in your Supabase Edge Functions dashboard
2. Make test calls without getting 404 errors
3. See function execution logs when testing
4. Use the Diagnostics tool in your app successfully

## 🆘 Need Help?

If you encounter issues:
1. Check the Supabase Dashboard for error messages
2. Review the function logs for specific error details
3. Verify all environment variables are correctly set
4. Ensure your Telnyx and OpenAI API keys are valid

Remember: This manual deployment is a one-time setup. Once deployed, the functions will remain active and accessible for your application.