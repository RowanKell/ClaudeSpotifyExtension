// DOM Elements
const authSection = document.getElementById('auth-section');
const playerSection = document.getElementById('player-section');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

const albumArt = document.getElementById('album-art');
const noPlayback = document.getElementById('no-playback');
const trackName = document.getElementById('track-name');
const artistName = document.getElementById('artist-name');

const prevBtn = document.getElementById('prev-btn');
const playPauseBtn = document.getElementById('play-pause-btn');
const nextBtn = document.getElementById('next-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');

const playlistBtn = document.getElementById('playlist-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const playlistModal = document.getElementById('playlist-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const playlistList = document.getElementById('playlist-list');

// State
let isPlaying = false;
let isShuffle = false;
let updateInterval = null;

// Initialize popup
async function init() {
  showLoading();

  // Check if user is authenticated
  const isAuthenticated = await checkAuth();

  if (isAuthenticated) {
    showPlayer();
    await updatePlaybackState();
    startAutoUpdate();
  } else {
    showAuth();
  }
}

// Check authentication status
async function checkAuth() {
  try {
    const result = await browser.storage.local.get(['accessToken', 'tokenExpiry']);

    if (!result.accessToken || !result.tokenExpiry) {
      return false;
    }

    // Check if token is expired
    if (Date.now() >= result.tokenExpiry) {
      // Try to refresh token
      const refreshed = await browser.runtime.sendMessage({ action: 'refreshToken' });
      return refreshed.success;
    }

    return true;
  } catch (error) {
    console.error('Auth check failed:', error);
    return false;
  }
}

// Show/Hide sections
function showAuth() {
  hideLoading();
  authSection.classList.remove('hidden');
  playerSection.classList.add('hidden');
}

function showPlayer() {
  hideLoading();
  authSection.classList.add('hidden');
  playerSection.classList.remove('hidden');
}

function showLoading() {
  loading.classList.remove('hidden');
  authSection.classList.add('hidden');
  playerSection.classList.add('hidden');
}

function hideLoading() {
  loading.classList.add('hidden');
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}

// Authentication
loginBtn.addEventListener('click', async () => {
  try {
    showLoading();
    const result = await browser.runtime.sendMessage({ action: 'authenticate' });

    if (result.success) {
      showPlayer();
      await updatePlaybackState();
      startAutoUpdate();
    } else {
      showAuth();
      showError('Authentication failed. Please try again.');
    }
  } catch (error) {
    console.error('Login error:', error);
    showAuth();
    showError('Login error: ' + error.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await browser.runtime.sendMessage({ action: 'logout' });
    stopAutoUpdate();
    showAuth();
  } catch (error) {
    console.error('Logout error:', error);
    showError('Logout failed');
  }
});

// Update playback state
async function updatePlaybackState() {
  try {
    const response = await browser.runtime.sendMessage({ action: 'getCurrentPlayback' });

    if (!response.success) {
      if (response.error === 'AUTH_REQUIRED') {
        showAuth();
        return;
      }
      showNoPlayback();
      return;
    }

    const data = response.data;

    if (!data || !data.item) {
      showNoPlayback();
      return;
    }

    // Update UI
    isPlaying = data.is_playing;
    isShuffle = data.shuffle_state || false;
    updatePlayPauseButton();
    updateShuffleButton();

    // Update album art
    const albumImageUrl = data.item.album.images[0]?.url;
    if (albumImageUrl) {
      albumArt.src = albumImageUrl;
      albumArt.style.display = 'block';
      noPlayback.classList.add('hidden');
    } else {
      showNoPlayback();
    }

    // Update track info
    trackName.textContent = data.item.name;
    artistName.textContent = data.item.artists.map(a => a.name).join(', ');

    // Enable controls
    prevBtn.disabled = false;
    playPauseBtn.disabled = false;
    nextBtn.disabled = false;

  } catch (error) {
    console.error('Update playback error:', error);
    showNoPlayback();
  }
}

function showNoPlayback() {
  albumArt.style.display = 'none';
  noPlayback.classList.remove('hidden');
  trackName.textContent = 'Not Playing';
  artistName.textContent = '-';

  // Disable controls
  prevBtn.disabled = true;
  playPauseBtn.disabled = true;
  nextBtn.disabled = true;
}

function updatePlayPauseButton() {
  if (isPlaying) {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
  } else {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  }
}

// Playback controls
playPauseBtn.addEventListener('click', async () => {
  try {
    const action = isPlaying ? 'pause' : 'play';
    const response = await browser.runtime.sendMessage({ action });

    if (response.success) {
      isPlaying = !isPlaying;
      updatePlayPauseButton();
      // Update state after a short delay
      setTimeout(updatePlaybackState, 500);
    } else {
      showError('Failed to ' + action + ' playback');
    }
  } catch (error) {
    console.error('Play/Pause error:', error);
    showError('Playback control failed');
  }
});

prevBtn.addEventListener('click', async () => {
  try {
    const response = await browser.runtime.sendMessage({ action: 'previous' });

    if (response && response.success) {
      // Update state after a short delay
      setTimeout(updatePlaybackState, 500);
    } else if (response && response.error) {
      showError('Failed to skip to previous track: ' + response.error);
    } else if (!response) {
      console.error('No response from background script');
      showError('Previous track failed - no response');
    }
  } catch (error) {
    console.error('Previous error:', error);
    showError('Previous track failed: ' + error.message);
  }
});

nextBtn.addEventListener('click', async () => {
  try {
    const response = await browser.runtime.sendMessage({ action: 'next' });

    if (response && response.success) {
      // Update state after a short delay
      setTimeout(updatePlaybackState, 500);
    } else if (response && response.error) {
      showError('Failed to skip to next track: ' + response.error);
    } else if (!response) {
      console.error('No response from background script');
      showError('Next track failed - no response');
    }
  } catch (error) {
    console.error('Next error:', error);
    showError('Next track failed: ' + error.message);
  }
});

// Auto-update playback state
function startAutoUpdate() {
  stopAutoUpdate();
  updateInterval = setInterval(updatePlaybackState, 3000); // Update every 3 seconds
}

function stopAutoUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

// Cleanup on popup close
window.addEventListener('unload', () => {
  stopAutoUpdate();
});

// Shuffle button functionality
function updateShuffleButton() {
  if (isShuffle) {
    shuffleBtn.classList.add('active');
  } else {
    shuffleBtn.classList.remove('active');
  }
}

shuffleBtn.addEventListener('click', async () => {
  try {
    const newShuffleState = !isShuffle;
    const response = await browser.runtime.sendMessage({
      action: 'toggleShuffle',
      state: newShuffleState
    });

    if (response && response.success) {
      isShuffle = newShuffleState;
      updateShuffleButton();
    } else if (response && response.error) {
      showError('Failed to toggle shuffle: ' + response.error);
    }
  } catch (error) {
    console.error('Shuffle toggle error:', error);
    showError('Shuffle toggle failed: ' + error.message);
  }
});

// Playlist functionality
playlistBtn.addEventListener('click', async () => {
  try {
    playlistModal.classList.remove('hidden');
    await loadPlaylists();
  } catch (error) {
    console.error('Playlist load error:', error);
    showError('Failed to load playlists');
  }
});

closeModalBtn.addEventListener('click', () => {
  playlistModal.classList.add('hidden');
});

// Close modal when clicking outside
playlistModal.addEventListener('click', (e) => {
  if (e.target === playlistModal) {
    playlistModal.classList.add('hidden');
  }
});

async function loadPlaylists() {
  try {
    // Show loading state
    playlistList.innerHTML = `
      <div class="playlist-loading">
        <div class="spinner"></div>
        <p>Loading playlists...</p>
      </div>
    `;

    const response = await browser.runtime.sendMessage({
      action: 'getUserPlaylists',
      limit: 50,
      offset: 0
    });

    if (response && response.success && response.data) {
      displayPlaylists(response.data.items);
    } else if (response && response.error) {
      playlistList.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">Failed to load playlists: ${response.error}</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Load playlists error:', error);
    playlistList.innerHTML = `
      <div class="playlist-loading">
        <p style="color: #ff6b6b;">Error loading playlists</p>
      </div>
    `;
  }
}

function displayPlaylists(playlists) {
  if (!playlists || playlists.length === 0) {
    playlistList.innerHTML = `
      <div class="playlist-loading">
        <p>No playlists found</p>
      </div>
    `;
    return;
  }

  playlistList.innerHTML = playlists.map(playlist => {
    const imageUrl = playlist.images[0]?.url || '';
    const trackCount = playlist.tracks?.total || 0;

    return `
      <div class="playlist-item" data-uri="${playlist.uri}">
        ${imageUrl ? `<img src="${imageUrl}" alt="${playlist.name}" class="playlist-image">` : '<div class="playlist-image"></div>'}
        <div class="playlist-info">
          <div class="playlist-name">${playlist.name}</div>
          <div class="playlist-tracks">${trackCount} track${trackCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers to playlist items
  document.querySelectorAll('.playlist-item').forEach(item => {
    item.addEventListener('click', async () => {
      const playlistUri = item.getAttribute('data-uri');
      await playPlaylist(playlistUri);
    });
  });
}

async function playPlaylist(playlistUri) {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'startPlaylist',
      playlistUri: playlistUri
    });

    if (response && response.success) {
      // Close the modal
      playlistModal.classList.add('hidden');

      // Update playback state after a short delay
      setTimeout(updatePlaybackState, 500);

      showError(''); // Clear any previous errors
    } else if (response && response.error) {
      showError('Failed to play playlist: ' + response.error);
    }
  } catch (error) {
    console.error('Play playlist error:', error);
    showError('Failed to play playlist: ' + error.message);
  }
}

// Initialize
init();
