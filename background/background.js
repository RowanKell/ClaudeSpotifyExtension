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
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-read'
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

// Get user's playlists
async function getUserPlaylists(limit = 50, offset = 0) {
  console.log('Fetching playlists with limit:', limit, 'offset:', offset);
  const result = await makeSpotifyRequest(`/me/playlists?limit=${limit}&offset=${offset}`);
  console.log('Playlists result:', result);
  return result;
}

// Get user's saved tracks (liked songs)
async function getSavedTracks(limit = 50, offset = 0) {
  console.log('Fetching saved tracks with limit:', limit, 'offset:', offset);
  const result = await makeSpotifyRequest(`/me/tracks?limit=${limit}&offset=${offset}`);
  console.log('Saved tracks result:', result);
  return result;
}

// Get user's saved albums
async function getSavedAlbums(limit = 50, offset = 0) {
  console.log('Fetching saved albums with limit:', limit, 'offset:', offset);
  const result = await makeSpotifyRequest(`/me/albums?limit=${limit}&offset=${offset}`);
  console.log('Saved albums result:', result);
  return result;
}

// Get user's queue
async function getQueue() {
  return await makeSpotifyRequest('/me/player/queue');
}

// Search for tracks
async function searchTracks(query, limit = 20) {
  const encodedQuery = encodeURIComponent(query);
  return await makeSpotifyRequest(`/search?q=${encodedQuery}&type=track&limit=${limit}`);
}

// Add track to queue
async function addToQueue(trackUri) {
  const encodedUri = encodeURIComponent(trackUri);
  return await makeSpotifyRequest(`/me/player/queue?uri=${encodedUri}`, { method: 'POST' });
}

// Get audio features for tracks (up to 100 tracks)
async function getAudioFeatures(trackIds) {
  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    return { success: false, error: 'No track IDs provided' };
  }

  // Spotify API accepts up to 100 track IDs
  const chunks = [];
  for (let i = 0; i < trackIds.length; i += 100) {
    chunks.push(trackIds.slice(i, i + 100));
  }

  const allFeatures = [];
  for (const chunk of chunks) {
    const ids = chunk.join(',');
    const result = await makeSpotifyRequest(`/audio-features?ids=${ids}`);

    if (result.success && result.data && result.data.audio_features) {
      allFeatures.push(...result.data.audio_features);
    }
  }

  return { success: true, data: { audio_features: allFeatures } };
}

// Get current user's profile (needed for creating playlists)
async function getCurrentUser() {
  return await makeSpotifyRequest('/me');
}

// Create a new playlist
async function createPlaylist(name, description = '', isPublic = false) {
  try {
    // Get current user ID
    const userResult = await getCurrentUser();
    if (!userResult.success || !userResult.data) {
      return { success: false, error: 'Failed to get user profile' };
    }

    const userId = userResult.data.id;

    // Create playlist
    return await makeSpotifyRequest(`/users/${userId}/playlists`, {
      method: 'POST',
      body: JSON.stringify({
        name: name,
        description: description,
        public: isPublic
      })
    });
  } catch (error) {
    console.error('Error creating playlist:', error);
    return { success: false, error: error.message };
  }
}

// Add tracks to a playlist
async function addTracksToPlaylist(playlistId, trackUris) {
  if (!Array.isArray(trackUris) || trackUris.length === 0) {
    return { success: false, error: 'No track URIs provided' };
  }

  // Spotify API accepts up to 100 tracks per request
  const chunks = [];
  for (let i = 0; i < trackUris.length; i += 100) {
    chunks.push(trackUris.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const result = await makeSpotifyRequest(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({
        uris: chunk
      })
    });

    if (!result.success) {
      return result;
    }
  }

  return { success: true };
}

// Start playing a playlist
async function startPlaylist(playlistUri) {
  return await makeSpotifyRequest('/me/player/play', {
    method: 'PUT',
    body: JSON.stringify({
      context_uri: playlistUri
    })
  });
}

// Start playing an album
async function startAlbum(albumUri) {
  return await makeSpotifyRequest('/me/player/play', {
    method: 'PUT',
    body: JSON.stringify({
      context_uri: albumUri
    })
  });
}

// Play liked songs (saved tracks)
async function playLikedSongs() {
  try {
    // Fetch the first 50 saved tracks
    const tracksResult = await getSavedTracks(50, 0);

    if (!tracksResult.success || !tracksResult.data || !tracksResult.data.items) {
      return { success: false, error: 'Failed to fetch saved tracks' };
    }

    // Extract track URIs
    const trackUris = tracksResult.data.items
      .filter(item => item.track && item.track.uri)
      .map(item => item.track.uri);

    if (trackUris.length === 0) {
      return { success: false, error: 'No saved tracks found' };
    }

    // Start playback with the track URIs
    return await makeSpotifyRequest('/me/player/play', {
      method: 'PUT',
      body: JSON.stringify({
        uris: trackUris
      })
    });
  } catch (error) {
    console.error('Error playing liked songs:', error);
    return { success: false, error: error.message };
  }
}

// Toggle shuffle mode
async function toggleShuffle(state) {
  return await makeSpotifyRequest(`/me/player/shuffle?state=${state}`, { method: 'PUT' });
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
    getUserPlaylists: getUserPlaylists,
    getSavedTracks: getSavedTracks,
    getSavedAlbums: getSavedAlbums,
    getQueue: getQueue,
    searchTracks: searchTracks,
    addToQueue: addToQueue,
    getAudioFeatures: getAudioFeatures,
    getCurrentUser: getCurrentUser,
    createPlaylist: createPlaylist,
    addTracksToPlaylist: addTracksToPlaylist,
    startPlaylist: startPlaylist,
    startAlbum: startAlbum,
    playLikedSongs: playLikedSongs,
    toggleShuffle: toggleShuffle,
    logout: logout
  };

  const action = actions[message.action];

  if (action) {
    // Handle actions with parameters
    if (message.action === 'getUserPlaylists') {
      action(message.limit, message.offset).then(sendResponse);
    } else if (message.action === 'searchTracks') {
      action(message.query, message.limit).then(sendResponse);
    } else if (message.action === 'addToQueue') {
      action(message.trackUri).then(sendResponse);
    } else if (message.action === 'startPlaylist') {
      action(message.playlistUri).then(sendResponse);
    } else if (message.action === 'toggleShuffle') {
      action(message.state).then(sendResponse);
    } else {
      action().then(sendResponse);
    }
    return true; // Indicates async response
  }

  return false;
});

console.log('Spotify Controller background script loaded');
console.log('Redirect URI:', REDIRECT_URI);
