# Production Setup Guide - Spotify Controller

This guide explains how to configure and deploy the Spotify Controller extension for Firefox.

## Table of Contents
1. [How Spotify OAuth Works](#how-spotify-oauth-works)
2. [Setting Up Spotify Developer App](#setting-up-spotify-developer-app)
3. [Configuring the Extension](#configuring-the-extension)
4. [Distribution Options](#distribution-options)
5. [Privacy & Security](#privacy--security)

---

## How Spotify OAuth Works

**Important**: You (the extension developer) only need to create ONE Spotify app. Here's how it works:

1. **You create a Spotify Developer app** → Get a Client ID
2. **Embed the Client ID** in the extension code
3. **Distribute the extension** to users
4. **Each user authenticates** with their own Spotify account
5. **Each user's data stays private** to them

Think of the Client ID as your extension's "identity" with Spotify. It's not a secret - it's meant to be embedded in client-side code.

---

## Setting Up Spotify Developer App

### Step 1: Create a Spotify Developer Account

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account (or create one)
3. Accept the Developer Terms of Service

### Step 2: Create an App

1. Click **"Create app"**
2. Fill in the details:
   - **App name**: "Spotify Controller" (or your preferred name)
   - **App description**: "Firefox extension for controlling Spotify playback"
   - **Redirect URI**: See step 3 below
   - **API**: Check "Web API"
   - Accept the terms and click **Create**

### Step 3: Configure Redirect URI

The redirect URI depends on your extension ID.

**Format**: `https://<extension-id>.extensions.allizom.org/`

Your current extension ID (from manifest.json): `spotify-controller@example.com`

So your redirect URI will be:
```
https://spotify-controller@example.com.extensions.allizom.org/
```

**To get the exact redirect URI**:
1. Load your extension temporarily in Firefox (about:debugging)
2. Open the extension popup
3. Click the options/settings icon (or go to about:addons → Extensions → Spotify Controller → Options)
4. You'll see the exact redirect URI displayed
5. Copy this URI and add it to your Spotify app settings

### Step 4: Get Your Client ID

1. In your Spotify app dashboard, click **"Settings"**
2. Copy your **Client ID** (it looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
3. Keep this handy for the next step

---

## Configuring the Extension

### Update background.js with Your Client ID

1. Open `background/background.js`
2. Find this line (around line 2):
   ```javascript
   const SPOTIFY_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
   ```
3. Replace `'YOUR_CLIENT_ID_HERE'` with your actual Client ID:
   ```javascript
   const SPOTIFY_CLIENT_ID = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
   ```

### Update manifest.json (Optional but Recommended)

1. Open `manifest.json`
2. Update the extension ID:
   ```json
   "browser_specific_settings": {
     "gecko": {
       "id": "spotify-controller@yourdomain.com"
     }
   }
   ```

**Important**: Once you use an ID and distribute your extension, don't change it! It's how Firefox tracks your extension.

---

## Distribution Options

### Option 1: Firefox Add-ons (AMO) - Recommended

**Best for**: Public extensions with automatic updates

**Steps**:
1. Create an account at [addons.mozilla.org](https://addons.mozilla.org)
2. Go to [Submit an Add-on](https://addons.mozilla.org/developers/addon/submit/)
3. Choose **"On this site"**
4. Package your extension:
   ```bash
   zip -r spotify-controller.zip * -x "*.git*" -x "*node_modules*"
   ```
5. Upload the .zip file
6. Fill in the listing details:
   - Name: "Spotify Controller"
   - Summary: "Control your Spotify playback directly from Firefox"
   - Description: Include features, screenshots, and usage instructions
   - Categories: Music, Productivity
7. Submit for review

**Review process**:
- Automated review: ~1 hour
- Manual review (if needed): 1-7 days
- Free signing included
- Automatic updates for users

### Option 2: Self-Distribution - For Private/Beta Use

**Best for**: Private use, testing, or beta releases

**Steps**:
1. Go to [Submit an Add-on](https://addons.mozilla.org/developers/addon/submit/)
2. Choose **"On your own"** (unlisted)
3. Upload your extension .zip file
4. Get the signed .xpi file
5. Host it yourself and share the link

**Benefits**:
- Not publicly listed
- Still signed by Mozilla (required for Firefox)
- You control distribution
- Faster review process

### Option 3: Temporary Loading - Development Only

**For development only** - extension is removed on Firefox restart:
1. Go to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `manifest.json`

---

## Privacy & Security

### What Data is Collected?

**By Your Extension**:
- User's Spotify auth tokens stored **locally** in browser.storage
- **No data is sent to any server except Spotify's API**

**By Spotify**:
- Standard OAuth data (user profile, playback state, playlists)
- See [Spotify Privacy Policy](https://www.spotify.com/privacy)

### Privacy Policy for AMO

If distributing on Firefox Add-ons, you need a privacy policy. Here's a template:

```markdown
# Privacy Policy for Spotify Controller

This extension does not collect, store, or transmit any personal data to external servers.

## Data Storage
- Spotify authentication tokens are stored locally in browser storage
- No data leaves your device except API calls to Spotify

## Third-Party Services
- Spotify Web API: Used for playback control and music data
- See Spotify's Privacy Policy: https://www.spotify.com/privacy

## Data You Can Control
- Revoke access: Log out from the extension or revoke access in your Spotify account settings at https://www.spotify.com/account/apps/
```

### Security Considerations

✅ **Safe for Production**:
- Client ID is meant to be public (not a secret)
- OAuth PKCE flow is secure for client-side apps
- No backend server needed
- User tokens never exposed to third parties

❌ **Do NOT include**:
- Client Secret (not needed for PKCE flow)
- Your personal Spotify credentials
- Any API keys or secrets

---

## Testing Before Release

### Pre-Release Checklist

- [ ] Client ID configured in background.js
- [ ] Redirect URI added to Spotify app settings
- [ ] Test authentication flow
- [ ] Test all features:
  - [ ] Playback controls (play, pause, next, previous)
  - [ ] Shuffle toggle
  - [ ] Playlist browsing and playback
  - [ ] Liked Songs
  - [ ] Queue viewing
  - [ ] Search and add to queue
- [ ] Test error scenarios:
  - [ ] No active device
  - [ ] No internet connection
  - [ ] Spotify Premium expired
- [ ] Update manifest.json extension ID
- [ ] Create screenshots for listing
- [ ] Write clear description
- [ ] Prepare privacy policy

### Common Issues

**"Authentication Failed"**
- Check Client ID is correct
- Check Redirect URI matches exactly
- Ensure Spotify app is not in Development Mode (request Extended Quota Mode)

**"No Active Device"**
- User needs to open Spotify somewhere (phone, desktop, web)
- Playback must be started at least once

**"403 Forbidden"**
- Could be Spotify Premium requirement
- Could be rate limiting
- Check all required scopes are requested

---

## Spotify Quota Limits

Spotify has user limits for apps:

- **Development Mode**: 25 users maximum
- **Extended Quota Mode**: Unlimited users (requires approval)

### Request Extended Quota Mode

Before public release, request extended quota:

1. Go to your Spotify app dashboard
2. Click **"Request Extension"** (or similar option)
3. Fill in the form:
   - Type of integration: "Browser Extension"
   - Number of users: Estimated (e.g., 1000+)
   - Description: "Firefox extension for controlling Spotify playback"
4. Submit

**Approval time**: Usually 1-3 days

---

## Maintaining Your Extension

### Versioning

Follow semantic versioning: `MAJOR.MINOR.PATCH`

Example updates:
- `1.0.0` → `1.0.1`: Bug fixes
- `1.0.1` → `1.1.0`: New features (like Smart Playlists)
- `1.1.0` → `2.0.0`: Breaking changes

Update `version` in manifest.json for each release.

### Updates for Users

**If on AMO**: Automatic updates
**If self-distributed**: Users must download new .xpi manually

---

## Additional Resources

- [Firefox Extension Workshop](https://extensionworkshop.com/)
- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [OAuth 2.0 PKCE Flow](https://oauth.net/2/pkce/)
- [Mozilla Add-ons Policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)

---

## Quick Start Summary

1. **Create Spotify app** → Get Client ID
2. **Add redirect URI** to Spotify app (from extension options page)
3. **Update background.js** with Client ID
4. **Test locally** (about:debugging → Load Temporary Add-on)
5. **Package as .zip** (exclude .git and other dev files)
6. **Submit to AMO** or distribute yourself
7. **Request Extended Quota Mode** for public release

That's it! Your extension is ready for production use.
