# Google Cloud Console Setup Guide

This guide walks you through setting up Google Cloud Console for the Google Photos Deduper app after the March 31, 2025 API changes.

## 📋 Overview

After March 31, 2025, Google Photos API removed several scopes. The app now uses minimal OAuth scopes only for user identification, while the Chrome Extension handles photo discovery directly from the web interface.

## 🚀 Step-by-Step Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project name: `Google Photos Deduper` (or your choice)
4. Click **Create**
5. Wait for project creation (takes ~30 seconds)

### Step 2: Enable Required APIs

1. In the left sidebar, navigate to **APIs & Services** → **Library**
2. Search for "**Google Photos Library API**"
3. Click on it, then click **Enable**
4. Wait for API to be enabled

> **Note:** We only need this API for accessing user profile information. Photo discovery is handled by the Chrome Extension.

### Step 3: Configure OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type
3. Click **Create**

#### App Information

Fill in the following:

- **App name:** `Google Photos Deduper`
- **User support email:** Your email address
- **App logo:** (Optional) Upload the logo from `client/public/logo.png`
- **App domain:**
  - Application home page: `http://localhost:3000` (for development)
  - Application privacy policy link: (Optional, or use GitHub repo)
  - Application terms of service link: (Optional, or use GitHub repo)
- **Authorized domains:** `localhost` (for development)
- **Developer contact information:** Your email address

Click **Save and Continue**

#### Scopes

⚠️ **IMPORTANT:** Only add these scopes (DO NOT add deprecated scopes):

1. Click **Add or Remove Scopes**
2. Search and select ONLY these scopes:
   - ✅ `openid`
   - ✅ `https://www.googleapis.com/auth/userinfo.email`
   - ✅ `https://www.googleapis.com/auth/userinfo.profile`

3. **DO NOT ADD** these deprecated scopes:
   - ❌ `https://www.googleapis.com/auth/photoslibrary.readonly`
   - ❌ `https://www.googleapis.com/auth/photoslibrary`
   - ❌ `https://www.googleapis.com/auth/photoslibrary.sharing`
   - ❌ `https://www.googleapis.com/auth/photoslibrary.appendonly`
   - ❌ `https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata`
   - ❌ `https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata`

4. Click **Update** → **Save and Continue**

#### Test Users

During development, your app is in "Testing" mode and only works for test users.

1. Click **Add Users**
2. Enter your Google account email
3. Add any other users who need access
4. Click **Save and Continue**

#### Summary

Review your settings and click **Back to Dashboard**

### Step 4: Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Application type:** Web application
4. **Name:** `Google Photos Deduper Web Client`

#### Configure Authorized URLs

**Authorized JavaScript origins:**
```
http://localhost:3000
http://localhost:5001
```

**Authorized redirect URIs:**
```
http://localhost:5001/auth/google/callback
```

> **For production:** Replace `localhost` with your actual domain

5. Click **Create**

### Step 5: Download Credentials

1. After creation, a modal appears with your credentials
2. Click **Download JSON**
3. Save the file as `client_secret.json` in your project root directory

The file should look like:
```json
{
  "web": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "project_id": "your-project-id",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": ["http://localhost:5001/auth/google/callback"],
    "javascript_origins": ["http://localhost:3000", "http://localhost:5001"]
  }
}
```

### Step 6: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp example.env .env
   ```

2. Open `.env` and update these values from your `client_secret.json`:
   ```bash
   GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
   ```

### Step 7: Verify Chrome Extension Access

The Chrome Extension needs to communicate with your local backend:

1. Navigate to **APIs & Services** → **Credentials**
2. Find your OAuth 2.0 Client ID
3. Click the edit icon (pencil)
4. Under **Authorized JavaScript origins**, add:
   ```
   chrome-extension://YOUR_EXTENSION_ID
   ```
   
   > **Note:** You'll get the extension ID after loading it in Chrome. Come back and add it here.

5. Click **Save**

## 🧪 Testing Your Setup

### Test Backend Connection

1. Start the application:
   ```bash
   docker-compose up --build
   ```

2. Open http://localhost:3000

3. Click "Sign in with Google"

4. You should see the OAuth consent screen

5. Grant permissions (only email and profile info)

6. You should be redirected back to the app

### Test Chrome Extension

1. Build the extension:
   ```bash
   docker compose -f chrome_extension/docker-compose.yml run node npm run build
   ```

2. Load extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `chrome_extension/dist`

3. Copy the Extension ID (looks like: `abcdefghijklmnopqrstuvwxyz`)

4. Go back to Google Cloud Console and add the extension ID to Authorized JavaScript origins:
   ```
   chrome-extension://abcdefghijklmnopqrstuvwxyz
   ```

5. Test the extension:
   - Navigate to https://photos.google.com
   - Click the extension icon
   - Click "Discover Photos"
   - Should start scanning your library

## 🚀 Publishing to Production

### Update OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**
2. Click **Publish App**
3. Google will review your app (can take several days)

### Update Credentials

1. Update **Authorized JavaScript origins** and **Authorized redirect URIs** with your production domain
2. Example for `https://your-domain.com`:
   ```
   https://your-domain.com
   https://api.your-domain.com
   https://api.your-domain.com/auth/google/callback
   ```

### Update Environment

1. Update `.env` with production values:
   ```bash
   CLIENT_HOST=https://your-domain.com
   GOOGLE_CLIENT_ID=your_production_client_id
   GOOGLE_CLIENT_SECRET=your_production_secret
   ```

### Publish Extension

1. Create a developer account at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay one-time registration fee ($5)
3. Package your extension
4. Submit for review
5. Once published, users can install from Chrome Web Store

## 🔒 Security Best Practices

### Protect Your Credentials

1. **Never commit** `client_secret.json` to version control
2. Add to `.gitignore`:
   ```
   client_secret.json
   .env
   ```

3. Use different credentials for development and production

### Scope Minimal Permissions

- Only request `openid`, `email`, and `profile` scopes
- Chrome Extension handles all photo access
- No API access to user's photo library

### Secure Your Backend

1. Use HTTPS in production
2. Set secure session cookies
3. Implement CSRF protection
4. Rate limit API endpoints

## 🐛 Troubleshooting

### Error: "redirect_uri_mismatch"

**Solution:** 
- Check that redirect URI in Google Cloud Console exactly matches your callback URL
- No trailing slashes
- Include protocol (http:// or https://)

### Error: "invalid_scope"

**Solution:**
- Remove any deprecated scopes from OAuth consent screen
- Only use: `openid`, `userinfo.email`, `userinfo.profile`

### Error: "Access blocked: This app's request is invalid"

**Solution:**
- Ensure OAuth consent screen is properly configured
- Add your email to Test Users list
- Verify App Information is complete

### Extension Can't Connect to Backend

**Solution:**
- Check backend is running on http://localhost:5001
- Verify extension has host permissions in manifest.json
- Check browser console for CORS errors
- Ensure you're logged in via the web app first

### OAuth Token Expired

**Solution:**
- Clear browser cookies for localhost
- Sign out and sign in again
- Check that `access_type: "offline"` is set in backend

## 📚 Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Photos API Updates](https://developers.google.com/photos/support/updates)
- [Chrome Extension OAuth](https://developer.chrome.com/docs/extensions/mv3/tut_oauth/)
- [OAuth Consent Screen Best Practices](https://developers.google.com/workspace/guides/configure-oauth-consent)

## 📞 Support

If you encounter issues:

1. Check [GitHub Issues](https://github.com/mahreencodes/google-photos-deduper/issues)
2. Review [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md)
3. Create a new issue with:
   - Error message
   - Steps to reproduce
   - Screenshots (without revealing credentials)

---

**Last Updated:** December 19, 2024  
**API Version:** Google Photos Library API v1 (Post-March 2025 changes)

