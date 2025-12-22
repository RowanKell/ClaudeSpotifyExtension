# Firefox Add-ons Submission Guide

This guide walks you through submitting your Spotify Controller extension to addons.mozilla.org (AMO) for public distribution.

## Pre-Submission Checklist

Before submitting, make sure you've completed these steps:

### 1. Configure Spotify Developer App

- [ ] Created Spotify Developer account
- [ ] Created Spotify app in Developer Dashboard
- [ ] Copied your Client ID
- [ ] Added redirect URI to Spotify app settings
- [ ] **Requested Extended Quota Mode** (for unlimited users)

**Important**: Request Extended Quota Mode BEFORE submitting:
1. Go to your Spotify app dashboard
2. Look for "Quota Extension" or "Request Extension"
3. Fill out the form:
   - Type: "Browser Extension"
   - Estimated users: 1000+ (or your estimate)
   - Description: "Firefox extension for Spotify playback control"
4. Submit and wait for approval (usually 1-3 days)

### 2. Update Extension Code

- [ ] Replace `YOUR_CLIENT_ID_HERE` in `background/background.js` with your actual Client ID
- [ ] Update `manifest.json` extension ID to something unique (e.g., `spotify-controller@yourname.com`)
- [ ] Test all features work with your Client ID
- [ ] Test on a clean Firefox profile

### 3. Prepare Assets

You'll need these for the AMO listing:

**Required:**
- [ ] Extension icon (already have: `icons/icon.svg`)
- [ ] At least 1 screenshot (PNG or JPG, max 5MB)
- [ ] Short description (250 characters max)
- [ ] Long description
- [ ] Privacy policy

**Recommended:**
- [ ] 2-4 screenshots showing different features
- [ ] Icon in multiple sizes (128x128, 64x64, 48x48)

---

## Step-by-Step Submission Process

### Step 1: Create Screenshots

Take screenshots of your extension in action:

1. Open Firefox and load your extension
2. Log into Spotify through the extension
3. Take screenshots of:
   - Main player view with album art
   - Playlist browser modal
   - Album browser modal
   - Queue viewer
   - Search function

**Tips:**
- Use 1280x800 or 1920x1080 resolution
- Show the extension in action, not just menus
- Make sure UI is clean (no personal data visible)
- Save as PNG or JPG

### Step 2: Package Your Extension

From your extension directory:

```bash
# Make sure you're on the basic release branch
git checkout claude/basic-release-011CV4fmzVcQVsmYMqYDArFL

# Create a clean package excluding development files
zip -r spotify-controller-v1.0.zip \
  manifest.json \
  background/ \
  popup/ \
  icons/ \
  show-redirect-uri.html \
  show-redirect-uri.js \
  -x "*.git*" -x "*.md" -x "TODO.md"

# Verify the zip contents
unzip -l spotify-controller-v1.0.zip
```

**What to exclude:**
- `.git/` directory
- `README.md`, `TODO.md`, `SETUP.md`, etc.
- Any test files or development tools
- Node modules (if any)

**What to include:**
- `manifest.json`
- `background/` folder
- `popup/` folder
- `icons/` folder
- `show-redirect-uri.html` and `show-redirect-uri.js`

### Step 3: Create AMO Account

1. Go to [addons.mozilla.org](https://addons.mozilla.org)
2. Click **"Register"** or **"Log in"**
3. Create a Firefox account (or log in if you have one)
4. Verify your email address

### Step 4: Submit Your Extension

1. Go to [Developer Hub](https://addons.mozilla.org/developers/)
2. Click **"Submit a New Add-on"**
3. Choose **"On this site"** (for public listing)

#### Page 1: Upload Version

1. **Upload your .zip file** (`spotify-controller-v1.0.zip`)
2. Wait for automatic validation (usually takes 1-2 minutes)
3. **Review validation results:**
   - Errors: Must fix before continuing
   - Warnings: Review but may be okay
   - Notices: Informational only

**Common validation issues:**
- Missing required fields in manifest
- Icon size issues
- Deprecated APIs

4. Click **"Continue"**

#### Page 2: Describe Add-on

**Add-on Name:** (32 characters max)
```
Spotify Controller
```

**Add-on URL:** (will auto-generate, you can customize)
```
spotify-controller
```

**Summary:** (250 characters max)
```
Control your Spotify playback directly from Firefox. Browse playlists and albums, manage queue, search tracks, and control playback - all with a beautiful visual interface.
```

**Description:** (can use HTML)
```html
<p>Spotify Controller brings comprehensive Spotify control directly to your Firefox browser.</p>

<h3>Features</h3>
<ul>
  <li><strong>Playback Controls:</strong> Play, pause, skip tracks, and toggle shuffle</li>
  <li><strong>Library Management:</strong> Browse and play your playlists, albums, and liked songs</li>
  <li><strong>Queue Management:</strong> View what's playing next and manage your queue</li>
  <li><strong>Search & Add:</strong> Search Spotify's catalog and add tracks to your queue</li>
  <li><strong>Visual Interface:</strong> See album artwork and track info at a glance</li>
</ul>

<h3>Requirements</h3>
<ul>
  <li>Spotify Premium account (required for playback control)</li>
  <li>Active Spotify session on a device (phone, desktop, or web player)</li>
</ul>

<h3>Setup</h3>
<ol>
  <li>Install the extension</li>
  <li>Click the Spotify icon in your toolbar</li>
  <li>Click "Connect to Spotify" and authorize the extension</li>
  <li>Start controlling your music!</li>
</ol>

<h3>Privacy</h3>
<p>This extension stores authentication tokens locally in your browser. No data is collected, tracked, or transmitted to any external servers except Spotify's official API.</p>

<p>For detailed setup instructions and troubleshooting, visit the project repository.</p>
```

**Categories:** Select 1-2
- [x] Music
- [ ] Productivity (optional)

**Tags:** (space-separated)
```
spotify music playback player controller
```

**Support Email:**
```
your-email@example.com
```

**Support Website:** (optional)
```
https://github.com/yourusername/ClaudeSpotifyExtension
```

**Homepage:** (optional)
```
https://github.com/yourusername/ClaudeSpotifyExtension
```

**License:**
- Select: **MIT License**

Click **"Continue"**

#### Page 3: Upload Screenshots

1. **Upload at least 1 screenshot** (recommended 3-5)
   - Main player view
   - Playlist browser
   - Album browser
   - Queue viewer
   - Search function

2. **Add captions** (optional but recommended)
   - "Main player with album artwork"
   - "Browse your playlists visually"
   - "View and play your saved albums"
   - "See what's playing next in the queue"
   - "Search and add tracks"

Click **"Continue"**

#### Page 4: Privacy Policy

**You MUST provide a privacy policy.** Paste this:

```
Privacy Policy for Spotify Controller

Last updated: [Current Date]

DATA COLLECTION
This extension does not collect, store, or transmit any personal data to external servers.

LOCAL STORAGE
- Spotify authentication tokens are stored locally in your browser's storage
- All data remains on your device
- No analytics, tracking, or telemetry is implemented

THIRD-PARTY SERVICES
This extension communicates exclusively with Spotify's official Web API for:
- User authentication (OAuth 2.0)
- Playback control
- Library access (playlists, albums, liked songs)
- Queue management
- Music search

For information about Spotify's data practices, see:
https://www.spotify.com/privacy

DATA YOU CONTROL
- Disconnect: Log out from the extension to clear stored tokens
- Revoke Access: Visit https://www.spotify.com/account/apps/ to revoke extension access

CHANGES TO THIS POLICY
We may update this privacy policy. Changes will be posted on this page.

CONTACT
For questions about this privacy policy, contact: [your-email@example.com]
```

Click **"Submit Version"**

---

## After Submission

### What Happens Next?

1. **Automatic Review** (5 minutes - 1 hour)
   - Automated security and code checks
   - Validates manifest and permissions
   - Scans for common issues

2. **Manual Review** (if needed, 1-7 days)
   - Human reviewer checks for:
     - Policy compliance
     - Security concerns
     - Code quality
     - Functionality

3. **Approval or Feedback**
   - **Approved**: Extension goes live immediately
   - **Needs Changes**: You'll receive specific feedback
   - **Rejected**: You can appeal or resubmit after fixing issues

### You'll Receive Email Notifications:

- When automatic review completes
- If manual review is needed
- When approved/rejected
- User reviews and ratings

### After Approval:

Your extension will be:
- ✅ Live on addons.mozilla.org
- ✅ Searchable in Firefox Add-ons
- ✅ Installable with one click
- ✅ Auto-updated for users when you submit new versions

---

## Common Rejection Reasons (And How to Avoid)

### 1. Missing or Insufficient Privacy Policy
**Fix:** Include the detailed privacy policy above

### 2. Hardcoded Credentials
**Fix:** Never commit Client Secrets to code (you're using PKCE, so you're good!)

### 3. Unclear Permissions
**Fix:** In manifest.json, add comments explaining why each permission is needed (for reviewers)

### 4. External Scripts
**Fix:** Don't load code from external URLs (you're not doing this)

### 5. Undisclosed Functionality
**Fix:** Make sure description matches what extension actually does

### 6. Poor Error Handling
**Fix:** You've already implemented this with user-friendly error messages

---

## Updating Your Extension

When you want to release updates:

1. **Update version** in `manifest.json`:
   ```json
   "version": "1.1.0"
   ```

2. **Package new version:**
   ```bash
   zip -r spotify-controller-v1.1.zip [files]
   ```

3. **Submit update:**
   - Go to Developer Hub
   - Click your extension
   - Click "Upload New Version"
   - Upload new .zip
   - Add release notes

4. **Approval:**
   - Updates usually get faster approval
   - Users automatically get the update

---

## Tips for Successful Submission

### Do's:
✅ Test thoroughly on clean Firefox profile
✅ Write clear, accurate description
✅ Include quality screenshots
✅ Provide comprehensive privacy policy
✅ Request Spotify Extended Quota BEFORE submitting
✅ Use descriptive version notes for updates
✅ Respond promptly to reviewer questions

### Don'ts:
❌ Don't include development files in package
❌ Don't use misleading descriptions
❌ Don't include hardcoded secrets
❌ Don't request unnecessary permissions
❌ Don't ignore validation warnings
❌ Don't submit with "YOUR_CLIENT_ID_HERE" still in code

---

## Monitoring Your Extension

After approval:

1. **Check Stats:**
   - Daily/weekly active users
   - Installation trends
   - Review ratings

2. **Respond to Reviews:**
   - Thank positive reviews
   - Address issues in negative reviews
   - Update extension based on feedback

3. **Monitor Support:**
   - Check support email regularly
   - Create GitHub issues page
   - Update FAQ based on common questions

---

## Quick Reference Checklist

Before clicking "Submit":

- [ ] Spotify Client ID is configured (not placeholder)
- [ ] Spotify Extended Quota Mode requested
- [ ] Extension tested on clean Firefox profile
- [ ] All features working correctly
- [ ] Screenshots prepared (3-5 images)
- [ ] Privacy policy written
- [ ] Support email set up
- [ ] manifest.json has unique extension ID
- [ ] .zip package created without dev files
- [ ] Description is clear and accurate

---

## Getting Help

**Mozilla Support:**
- [Extension Workshop](https://extensionworkshop.com/)
- [AMO Developer Forums](https://discourse.mozilla.org/c/add-ons/35)
- [Review Guidelines](https://extensionworkshop.com/documentation/publish/add-on-policies/)

**Spotify API:**
- [Developer Forum](https://community.spotify.com/t5/Spotify-for-Developers/bd-p/Spotify_Developer)
- [Web API Reference](https://developer.spotify.com/documentation/web-api)

**Your Extension:**
- GitHub Issues (set this up for users)
- Support email
- Extension reviews on AMO

---

## Congratulations! 🎉

Once approved, your extension will be:
- Available to millions of Firefox users
- Searchable on addons.mozilla.org
- Installable with one click
- Auto-updating for users

Good luck with your submission!
