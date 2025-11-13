// Spotify API Configuration
// IMPORTANT: Users need to set these values from their Spotify Developer Dashboard
const SPOTIFY_CLIENT_ID = 'YOUR_CLIENT_ID_HERE'; // Get from https://developer.spotify.com/dashboard
const REDIRECT_URI = browser.identity.getRedirectURL();

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

// Scopes required for the extension
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing'
].join(' ');

// Generate random string for PKCE
function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

// Generate code challenge for PKCE
async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// OAuth Authentication
async function authenticate() {
  try {
    // Check if client ID is set
    if (SPOTIFY_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
      throw new Error('Please set your Spotify Client ID in background.js');
    }

    // Generate PKCE parameters
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomString(16);

    // Store code verifier for later use
    await browser.storage.local.set({ codeVerifier, state });

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state: state,
      scope: SCOPES
    });

    const authUrl = `${SPOTIFY_AUTH_URL}?${params.toString()}`;

    // Launch OAuth flow
    const redirectUrl = await browser.identity.launchWebAuthFlow({
      interactive: true,
      url: authUrl
    });

    // Parse the redirect URL
    const url = new URL(redirectUrl);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');

    // Verify state
    const stored = await browser.storage.local.get(['state']);
    if (returnedState !== stored.state) {
      throw new Error('State mismatch - possible CSRF attack');
    }

    // Exchange code for tokens
    await exchangeCodeForToken(code, codeVerifier);

    return { success: true };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: error.message };
  }
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code, codeVerifier) {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }

  const data = await response.json();

  // Store tokens
  await browser.storage.local.set({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiry: Date.now() + (data.expires_in * 1000)
  });
}

// Refresh access token
async function refreshToken() {
  try {
    const stored = await browser.storage.local.get(['refreshToken']);

    if (!stored.refreshToken) {
      return { success: false, error: 'No refresh token' };
    }

    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: stored.refreshToken
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();

    // Store new access token
    await browser.storage.local.set({
      accessToken: data.access_token,
      tokenExpiry: Date.now() + (data.expires_in * 1000)
    });

    // Update refresh token if provided
    if (data.refresh_token) {
      await browser.storage.local.set({
        refreshToken: data.refresh_token
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Token refresh error:', error);
    return { success: false, error: error.message };
  }
}

// Make authenticated Spotify API request
async function makeSpotifyRequest(endpoint, options = {}) {
  try {
    // Get access token
    const stored = await browser.storage.local.get(['accessToken', 'tokenExpiry']);

    if (!stored.accessToken) {
      return { success: false, error: 'AUTH_REQUIRED' };
    }

    // Check if token is expired
    if (Date.now() >= stored.tokenExpiry) {
      const refreshed = await refreshToken();
      if (!refreshed.success) {
        return { success: false, error: 'AUTH_REQUIRED' };
      }
      // Get new token
      const newStored = await browser.storage.local.get(['accessToken']);
      stored.accessToken = newStored.accessToken;
    }

    // Make request
    const response = await fetch(`${SPOTIFY_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${stored.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    // Handle 204 No Content (success with no body)
    if (response.status === 204) {
      return { success: true, data: null };
    }

    // Handle 401 Unauthorized
    if (response.status === 401) {
      // Try to refresh token once
      const refreshed = await refreshToken();
      if (refreshed.success) {
        // Retry the request
        return makeSpotifyRequest(endpoint, options);
      }
      return { success: false, error: 'AUTH_REQUIRED' };
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    // Check if response has content before parsing JSON
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');

    // Handle empty responses or non-JSON content
    if (!contentType || !contentType.includes('application/json') || contentLength === '0') {
      return { success: true, data: null };
    }

    // Try to parse JSON, handle empty bodies gracefully
    try {
      const text = await response.text();
      if (!text || text.trim() === '') {
        return { success: true, data: null };
      }
      const data = JSON.parse(text);
      return { success: true, data };
    } catch (parseError) {
      // If JSON parsing fails but request was successful, return success with no data
      console.warn('Failed to parse response JSON:', parseError);
      return { success: true, data: null };
    }
  } catch (error) {
    console.error('Spotify API error:', error);
    return { success: false, error: error.message };
  }
}

// Get current playback state
async function getCurrentPlayback() {
  return await makeSpotifyRequest('/me/player');
}

// Play
async function play() {
  return await makeSpotifyRequest('/me/player/play', { method: 'PUT' });
}

// Pause
async function pause() {
  return await makeSpotifyRequest('/me/player/pause', { method: 'PUT' });
}

// Skip to next track
async function next() {
  return await makeSpotifyRequest('/me/player/next', { method: 'POST' });
}

// Skip to previous track
async function previous() {
  return await makeSpotifyRequest('/me/player/previous', { method: 'POST' });
}

// Logout
async function logout() {
  await browser.storage.local.remove([
    'accessToken',
    'refreshToken',
    'tokenExpiry',
    'codeVerifier',
    'state'
  ]);
  return { success: true };
}

// Message listener
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const actions = {
    authenticate: authenticate,
    refreshToken: refreshToken,
    getCurrentPlayback: getCurrentPlayback,
    play: play,
    pause: pause,
    next: next,
    previous: previous,
    logout: logout
  };

  const action = actions[message.action];

  if (action) {
    action().then(sendResponse);
    return true; // Indicates async response
  }

  return false;
});

console.log('Spotify Controller background script loaded');
console.log('Redirect URI:', REDIRECT_URI);
