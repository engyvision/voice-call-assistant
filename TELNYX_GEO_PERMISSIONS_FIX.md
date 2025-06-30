# 🚨 URGENT: Fix Telnyx Geographic Permissions Error

## Problem Identified
Error: "Dialed number is not included in whitelisted countries D13"

This means your Telnyx account doesn't have permission to call the target country. This is a **geographic permissions restriction**.

## 🔧 Immediate Fix Steps

### Step 1: Enable Geographic Permissions in Telnyx Portal

1. **Go to**: https://portal.telnyx.com
2. **Navigate to**: Voice → Outbound Voice Profiles
3. **Create/Edit an Outbound Voice Profile**:
   - Click "Create Outbound Voice Profile" (or edit existing)
   - **Profile Name**: "International Calling"
   
4. **Enable Countries**:
   - ✅ **United States** (+1)
   - ✅ **Portugal** (+351) 
   - ✅ **United Kingdom** (+44)
   - ✅ **Canada** (+1)
   - ✅ Any other countries you want to call
   
5. **Save the Profile**

### Step 2: Apply Profile to Your Connection

1. **Go to**: Voice → Connections
2. **Find your connection**: "AI Call Assistant"
3. **Edit the connection**
4. **Outbound Voice Profile**: Select "International Calling" (the profile you just created)
5. **Save Changes**

### Step 3: Alternative - Enable All Countries (Recommended)

For maximum flexibility:

1. **In Outbound Voice Profile settings**
2. **Select**: "Enable all countries" or "Global calling"
3. **Apply to your connection**

### Step 4: Wait for Propagation

- **Wait**: 5-10 minutes for changes to take effect
- Telnyx needs time to update permissions globally

## 🧪 Test the Fix

### Test 1: Try Different Numbers
Test with numbers from different countries:

```bash
# US number (should work if US is enabled)
+1-555-123-4567

# Portugal number (if calling Portugal)
+351-21-123-4567

# UK number (if calling UK)
+44-20-1234-5678
```

### Test 2: Check Your Target Country
What country are you trying to call? The error suggests the target country isn't enabled.

**Common country codes:**
- **+1**: US/Canada
- **+351**: Portugal  
- **+44**: UK
- **+33**: France
- **+49**: Germany
- **+34**: Spain

### Test 3: Verify in Telnyx Portal
1. Go to Voice → Outbound Voice Profiles
2. Check your profile shows the target country as ✅ enabled
3. Verify the profile is applied to your connection

## 🔍 Troubleshooting

### Issue 1: "Profile not applied"
**Fix**: 
1. Go to Voice → Connections
2. Edit your connection
3. Ensure Outbound Voice Profile is selected
4. Save changes

### Issue 2: "Country still not enabled"
**Fix**:
1. Wait longer (up to 15 minutes)
2. Try enabling "Global calling" instead of individual countries
3. Contact Telnyx support if issue persists

### Issue 3: "Billing restrictions"
**Fix**:
1. Check your Telnyx account has sufficient balance
2. Verify billing information is up to date
3. Some countries require additional verification

## 📞 Quick Country Enable Guide

### For US/Canada Calling:
1. Enable country code **+1**
2. This covers both US and Canada

### For European Calling:
1. Enable **+44** (UK)
2. Enable **+33** (France) 
3. Enable **+49** (Germany)
4. Enable **+351** (Portugal)
5. Enable **+34** (Spain)

### For Global Calling:
1. Select "Enable all countries"
2. This allows calling anywhere (recommended)

## ⚡ Quick Fix Summary

1. **Go to Telnyx Portal** → Voice → Outbound Voice Profiles
2. **Create profile** with target countries enabled
3. **Apply profile** to your Voice API connection
4. **Wait 5-10 minutes** for propagation
5. **Test call again**

## 🎯 Your Specific Fix

Based on your phone number (+351210600099), you're likely calling:

### If calling within Portugal:
- Enable **+351** (Portugal)

### If calling internationally:
- Enable **+1** (US/Canada)
- Enable **+44** (UK)
- Enable other countries as needed

### Recommended: Enable Global Calling
- Select "Enable all countries" for maximum flexibility

## 🚨 Important Notes

- **Billing**: International calls may have different rates
- **Verification**: Some countries require identity verification
- **Compliance**: Ensure you comply with local calling regulations
- **Testing**: Always test with your own number first

Once you enable the target country in your Outbound Voice Profile and apply it to your connection, the "whitelisted countries" error will disappear! 🎉

## 📋 Step-by-Step Checklist

- [ ] ✅ Log into Telnyx Portal
- [ ] ✅ Go to Voice → Outbound Voice Profiles  
- [ ] ✅ Create/edit profile with target countries
- [ ] ✅ Apply profile to your Voice API connection
- [ ] ✅ Wait 5-10 minutes
- [ ] ✅ Test call again
- [ ] ✅ Verify call goes through without geo error

The geographic permissions fix should resolve your calling issue immediately! 🚀