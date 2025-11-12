# Spotify Firefox Extension - TODO List

## Phase 1: Project Setup
- [x] Create project directory structure
- [ ] Create manifest.json for Firefox extension
- [ ] Set up basic HTML popup interface
- [ ] Create CSS for styling the popup
- [ ] Set up JavaScript files structure

## Phase 2: Spotify API Integration
- [ ] Register application with Spotify Developer Dashboard
- [ ] Implement OAuth 2.0 authentication flow
- [ ] Create background script for API communication
- [ ] Implement token storage and refresh mechanism
- [ ] Add API endpoints for:
  - Get currently playing track
  - Play/pause playback
  - Skip to next track
  - Skip to previous track
  - Get album artwork

## Phase 3: Core Features Implementation
- [ ] Create popup UI with:
  - Album cover display area
  - Track title and artist name
  - Play/pause button
  - Previous track button
  - Next track button
- [ ] Implement play/pause functionality
- [ ] Implement skip forward (next track)
- [ ] Implement skip backward (previous track)
- [ ] Display album artwork
- [ ] Display current track information
- [ ] Add loading states
- [ ] Add error handling

## Phase 4: UI/UX Enhancements
- [ ] Style buttons with appropriate icons
- [ ] Add hover effects
- [ ] Add smooth transitions
- [ ] Ensure responsive design
- [ ] Add authentication status indicator
- [ ] Create login/logout functionality

## Phase 5: Testing & Polish
- [ ] Test authentication flow
- [ ] Test all playback controls
- [ ] Test with no active playback
- [ ] Handle edge cases (no internet, API errors, etc.)
- [ ] Add user feedback for actions
- [ ] Optimize performance

## Phase 6: Documentation
- [ ] Create README.md with:
  - Installation instructions
  - Setup guide for Spotify API credentials
  - Usage instructions
  - Screenshots
- [ ] Add code comments
- [ ] Create setup guide for developers

## File Structure
```
ClaudeSpotifyExtension/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/
│   └── background.js
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── assets/
│   └── (UI assets)
├── README.md
└── TODO.md
```

## Dependencies & APIs
- Spotify Web API
- Firefox Extension APIs (browser.*)
- OAuth 2.0 PKCE flow for security
