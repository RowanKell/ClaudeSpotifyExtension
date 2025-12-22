# Spotify Controller - Firefox Extension

A beautiful Firefox extension that brings Spotify control directly to your browser with rich features for managing your music.

## Features

### 🎵 Playback Controls
- **Play/Pause** - Control playback with one click
- **Skip Tracks** - Next and previous track buttons
- **Shuffle** - Toggle shuffle mode on/off
- **Album Artwork** - Display current track's album cover
- **Track Information** - Show track name and artist
- **Real-time Updates** - Automatically updates playback state

### 📋 Library Management
- **Playlist Browsing** - View and play your saved playlists
- **Album Browsing** - View and play your saved albums
- **Liked Songs** - Quick access to your liked songs collection
- **Visual Interface** - See artwork and track counts for all your music

### 🎼 Queue Management
- **View Queue** - See what's playing next
- **Current Track** - Highlighted view of now playing
- **Track Details** - See all upcoming tracks with album art

### 🔍 Search & Add
- **Search Spotify** - Search the entire Spotify catalog
- **Add to Queue** - Add any track directly to your queue
- **Preview Info** - See artist and album before adding

### 🔐 Secure Authentication
- **OAuth 2.0 PKCE** - Industry-standard secure authentication
- **Token Refresh** - Automatic token renewal
- **Privacy Focused** - Credentials stored locally

## Screenshots

[Extension will display the current playing track with album art and playback controls]

## Installation

### Prerequisites

1. A Spotify Premium account (required for playback control API)
2. Firefox browser (version 57.0 or higher)

### Step 1: Register Spotify Application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create an App"
4. Fill in the app details:
   - **App Name**: Spotify Controller (or any name you prefer)
   - **App Description**: Firefox extension for Spotify control
   - Accept the terms and click "Create"
5. Once created, note your **Client ID**
6. Click "Edit Settings"
7. Add Redirect URI:
   - In Firefox, temporarily load the extension (see Step 2)
   - Open the Browser Console (Ctrl+Shift+J or Cmd+Shift+J)
   - Look for the message: "Redirect URI: [some URL]"
   - Copy this URL and add it to the Redirect URIs in Spotify Dashboard
   - Click "Add" and then "Save"

### Step 2: Configure the Extension

1. Clone or download this repository
2. Open `background/background.js` in a text editor
3. Find the line:
   ```javascript
   const SPOTIFY_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
   ```
4. Replace `YOUR_CLIENT_ID_HERE` with your actual Client ID from Spotify Dashboard
5. Save the file

### Step 3: Load the Extension in Firefox

#### Temporary Installation (for testing)

1. Open Firefox
2. Navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Navigate to the extension directory and select `manifest.json`
5. The extension is now loaded temporarily (will be removed when Firefox restarts)

#### Permanent Installation (requires signing)

For permanent installation, the extension needs to be signed by Mozilla:

1. Create a ZIP file of all extension files
2. Go to [Firefox Add-ons Developer Hub](https://addons.mozilla.org/developers/)
3. Sign in and submit your extension for signing
4. Once signed, install the signed XPI file

For development purposes, temporary installation is sufficient.

## Usage

### First Time Setup

1. Click the Spotify Controller icon in your Firefox toolbar
2. Click "Connect to Spotify"
3. You'll be redirected to Spotify's authorization page
4. Log in and authorize the application
5. You'll be redirected back to Firefox

### Controlling Playback

Once authenticated:

- **Album Art** - Displays the current track's album cover
- **Track Info** - Shows track name and artist
- **Play/Pause** - Click the center button to toggle playback
- **Previous** - Click the left button to go to previous track
- **Next** - Click the right button to skip to next track

The extension automatically updates every 3 seconds to reflect current playback state.

### Disconnecting

Click the "Disconnect" button at the bottom of the popup to log out and clear stored credentials.

## Project Structure

```
ClaudeSpotifyExtension/
├── manifest.json           # Extension configuration
├── popup/
│   ├── popup.html         # Popup UI structure
│   ├── popup.css          # Popup styling
│   └── popup.js           # Popup logic and event handlers
├── background/
│   └── background.js      # Background script for API communication
├── icons/
│   └── icon.svg           # Extension icon
├── README.md              # This file
└── TODO.md                # Development checklist
```

## Technical Details

### Authentication Flow

The extension uses OAuth 2.0 with PKCE (Proof Key for Code Exchange) for secure authentication:

1. User clicks "Connect to Spotify"
2. Extension generates code verifier and challenge
3. User is redirected to Spotify's authorization page
4. After authorization, Spotify redirects back with authorization code
5. Extension exchanges code for access and refresh tokens
6. Tokens are stored securely in browser storage

### API Endpoints Used

- `/me/player` - Get current playback state
- `/me/player/play` - Resume playback
- `/me/player/pause` - Pause playback
- `/me/player/next` - Skip to next track
- `/me/player/previous` - Skip to previous track

### Required Spotify Scopes

- `user-read-playback-state` - Read current playback state
- `user-modify-playback-state` - Control playback
- `user-read-currently-playing` - Read currently playing track

## Troubleshooting

### "Please set your Spotify Client ID" Error

Make sure you've replaced `YOUR_CLIENT_ID_HERE` in `background/background.js` with your actual Client ID from Spotify Dashboard.

### Authentication Fails

1. Verify your Redirect URI is correctly set in Spotify Dashboard
2. Make sure you're using the exact redirect URI shown in the browser console
3. Clear browser storage and try authenticating again

### No Playback Detected

1. Make sure you have Spotify Premium (required for API access)
2. Ensure Spotify is actively playing on one of your devices
3. Check that you've granted all required permissions

### Extension Not Working After Firefox Restart

If you used temporary installation, you need to reload the extension after each Firefox restart. For permanent use, consider signing the extension.

## Development

### Building from Source

No build step required! This is a pure JavaScript extension.

### Making Changes

1. Edit the source files
2. Reload the extension in `about:debugging`
3. Test your changes

### Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## Privacy

This extension:
- Only requests necessary Spotify permissions
- Stores tokens locally in browser storage
- Does not collect or transmit any personal data
- Only communicates with Spotify's official API

## License

MIT License - feel free to use and modify as needed.

## Credits

Created using Firefox WebExtensions API and Spotify Web API.

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api/)
3. Check [Firefox Extension Documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)

## Limitations

- Requires Spotify Premium account
- Cannot control volume (Spotify API limitation for some endpoints)
- Requires active Spotify session on a device
- Playback state updates every 3 seconds (not real-time)

## Future Enhancements

Potential features for future versions:
- **Smart Playlists** - ML-powered recommendations based on work context
- **Volume Control** - Adjust volume (if supported by active device)
- **Seek/Scrub** - Jump to any point in a track
- **Keyboard Shortcuts** - Control playback without clicking
- **Custom Themes** - Personalize the extension appearance
- **Playlist Creation** - Create and edit playlists from the extension
