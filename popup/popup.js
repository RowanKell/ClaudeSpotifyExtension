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

// State
let isPlaying = false;
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
    updatePlayPauseButton();

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

// Initialize
init();
