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

const albumBtn = document.getElementById('album-btn');
const albumModal = document.getElementById('album-modal');
const closeAlbumModalBtn = document.getElementById('close-album-modal-btn');
const albumList = document.getElementById('album-list');

const queueBtn = document.getElementById('queue-btn');
const queueModal = document.getElementById('queue-modal');
const closeQueueModalBtn = document.getElementById('close-queue-modal-btn');
const queueList = document.getElementById('queue-list');

const searchBtn = document.getElementById('search-btn');
const searchModal = document.getElementById('search-modal');
const closeSearchModalBtn = document.getElementById('close-search-modal-btn');
const searchInput = document.getElementById('search-input');
const searchSubmitBtn = document.getElementById('search-submit-btn');
const searchResults = document.getElementById('search-results');

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
  if (!message || message.trim() === '') {
    errorMessage.classList.add('hidden');
    return;
  }
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

    console.log('Playlists response:', response);

    if (!response) {
      playlistList.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">No response from background script</p>
        </div>
      `;
      return;
    }

    if (response.error === 'AUTH_REQUIRED') {
      playlistList.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">Please disconnect and reconnect to grant playlist permissions</p>
        </div>
      `;
      return;
    }

    if (!response.success) {
      playlistList.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">Failed to load playlists: ${response.error || 'Unknown error'}</p>
        </div>
      `;
      return;
    }

    if (!response.data) {
      playlistList.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">No playlist data received</p>
        </div>
      `;
      return;
    }

    displayPlaylists(response.data.items);
  } catch (error) {
    console.error('Load playlists error:', error);
    playlistList.innerHTML = `
      <div class="playlist-loading">
        <p style="color: #ff6b6b;">Error: ${error.message || 'Unknown error'}</p>
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

  // Create Liked Songs entry
  const likedSongsHtml = `
    <div class="playlist-item liked-songs-item" data-type="liked-songs">
      <div class="playlist-image liked-songs-image">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </div>
      <div class="playlist-info">
        <div class="playlist-name">Liked Songs</div>
        <div class="playlist-tracks">Your saved tracks</div>
      </div>
    </div>
  `;

  // Create regular playlists
  const playlistsHtml = playlists.map(playlist => {
    const imageUrl = playlist.images?.[0]?.url || '';
    const trackCount = playlist.tracks?.total || 0;

    return `
      <div class="playlist-item" data-uri="${playlist.uri || ''}">
        ${imageUrl ? `<img src="${imageUrl}" alt="${playlist.name || 'Playlist'}" class="playlist-image">` : '<div class="playlist-image"></div>'}
        <div class="playlist-info">
          <div class="playlist-name">${playlist.name || 'Unnamed Playlist'}</div>
          <div class="playlist-tracks">${trackCount} track${trackCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `;
  }).join('');

  playlistList.innerHTML = likedSongsHtml + playlistsHtml;

  // Add click handlers to playlist items
  document.querySelectorAll('.playlist-item').forEach(item => {
    item.addEventListener('click', async () => {
      const type = item.getAttribute('data-type');
      if (type === 'liked-songs') {
        await playLikedSongs();
      } else {
        const playlistUri = item.getAttribute('data-uri');
        await playPlaylist(playlistUri);
      }
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
    } else if (response && response.error) {
      showError('Failed to play playlist: ' + response.error);
    }
  } catch (error) {
    console.error('Play playlist error:', error);
    showError('Failed to play playlist: ' + error.message);
  }
}

async function playLikedSongs() {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'playLikedSongs'
    });

    if (response && response.success) {
      // Close the modal
      playlistModal.classList.add('hidden');

      // Update playback state after a short delay
      setTimeout(updatePlaybackState, 500);
    } else if (response && response.error) {
      showError('Failed to play liked songs: ' + response.error);
    }
  } catch (error) {
    console.error('Play liked songs error:', error);
    showError('Failed to play liked songs: ' + error.message);
  }
}

// Album functionality
albumBtn.addEventListener('click', async () => {
  try {
    albumModal.classList.remove('hidden');
    await loadAlbums();
  } catch (error) {
    console.error('Album load error:', error);
    showError('Failed to load albums');
  }
});

closeAlbumModalBtn.addEventListener('click', () => {
  albumModal.classList.add('hidden');
});

// Close modal when clicking outside
albumModal.addEventListener('click', (e) => {
  if (e.target === albumModal) {
    albumModal.classList.add('hidden');
  }
});

async function loadAlbums() {
  try {
    // Show loading state
    albumList.innerHTML = `
      <div class="playlist-loading">
        <div class="spinner"></div>
        <p>Loading albums...</p>
      </div>
    `;

    // Fetch albums
    const response = await browser.runtime.sendMessage({
      action: 'getSavedAlbums',
      limit: 50,
      offset: 0
    });

    if (!response.success) {
      albumList.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">Failed to load albums: ${response.error || 'Unknown error'}</p>
        </div>
      `;
      return;
    }

    if (!response.data) {
      albumList.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">No album data received</p>
        </div>
      `;
      return;
    }

    displayAlbums(response.data.items);
  } catch (error) {
    console.error('Load albums error:', error);
    albumList.innerHTML = `
      <div class="playlist-loading">
        <p style="color: #ff6b6b;">Error: ${error.message || 'Unknown error'}</p>
      </div>
    `;
  }
}

function displayAlbums(albums) {
  if (!albums || albums.length === 0) {
    albumList.innerHTML = `
      <div class="playlist-loading">
        <p>No albums found</p>
      </div>
    `;
    return;
  }

  albumList.innerHTML = albums.map(item => {
    const album = item.album;
    const imageUrl = album.images?.[0]?.url || '';
    const trackCount = album.total_tracks || 0;
    const artistNames = album.artists?.map(a => a.name).join(', ') || 'Unknown Artist';

    return `
      <div class="playlist-item" data-uri="${album.uri || ''}">
        ${imageUrl ? `<img src="${imageUrl}" alt="${album.name || 'Album'}" class="playlist-image">` : '<div class="playlist-image"></div>'}
        <div class="playlist-info">
          <div class="playlist-name">${album.name || 'Unnamed Album'}</div>
          <div class="playlist-tracks">${artistNames} • ${trackCount} tracks</div>
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers
  document.querySelectorAll('#album-list .playlist-item').forEach(item => {
    item.addEventListener('click', async () => {
      const albumUri = item.getAttribute('data-uri');
      await playAlbum(albumUri);
    });
  });
}

async function playAlbum(albumUri) {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'startAlbum',
      albumUri: albumUri
    });

    if (response && response.success) {
      // Close the modal
      albumModal.classList.add('hidden');

      // Update playback state after a short delay
      setTimeout(updatePlaybackState, 500);
    } else if (response && response.error) {
      // Use the detailed message if available, otherwise use the error code
      const errorMsg = response.message || response.error;
      showError(errorMsg);
    }
  } catch (error) {
    console.error('Play album error:', error);
    showError('Failed to play album: ' + error.message);
  }
}

// Queue functionality
queueBtn.addEventListener('click', async () => {
  try {
    queueModal.classList.remove('hidden');
    await loadQueue();
  } catch (error) {
    console.error('Queue load error:', error);
    showError('Failed to load queue');
  }
});

closeQueueModalBtn.addEventListener('click', () => {
  queueModal.classList.add('hidden');
});

// Close queue modal when clicking outside
queueModal.addEventListener('click', (e) => {
  if (e.target === queueModal) {
    queueModal.classList.add('hidden');
  }
});

async function loadQueue() {
  try {
    // Show loading state
    queueList.innerHTML = `
      <div class="playlist-loading">
        <div class="spinner"></div>
        <p>Loading queue...</p>
      </div>
    `;

    const response = await browser.runtime.sendMessage({
      action: 'getQueue'
    });

    console.log('Queue response:', response);

    if (!response) {
      queueList.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">No response from background script</p>
        </div>
      `;
      return;
    }

    if (response.error === 'AUTH_REQUIRED') {
      queueList.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">Please reconnect to Spotify</p>
        </div>
      `;
      return;
    }

    if (!response.success) {
      queueList.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">Failed to load queue: ${response.error || 'Unknown error'}</p>
        </div>
      `;
      return;
    }

    if (!response.data) {
      queueList.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">No queue data received</p>
        </div>
      `;
      return;
    }

    displayQueue(response.data);
  } catch (error) {
    console.error('Load queue error:', error);
    queueList.innerHTML = `
      <div class="playlist-loading">
        <p style="color: #ff6b6b;">Error: ${error.message || 'Unknown error'}</p>
      </div>
    `;
  }
}

function displayQueue(queueData) {
  const currentlyPlaying = queueData.currently_playing;
  const queue = queueData.queue || [];

  if (!currentlyPlaying && queue.length === 0) {
    queueList.innerHTML = `
      <div class="playlist-loading">
        <p>Queue is empty</p>
      </div>
    `;
    return;
  }

  let html = '';

  // Show currently playing
  if (currentlyPlaying) {
    html += '<div class="queue-section-header">Now Playing</div>';
    html += createQueueItem(currentlyPlaying, true);
  }

  // Show upcoming tracks
  if (queue.length > 0) {
    html += '<div class="queue-section-header">Up Next</div>';
    queue.forEach(track => {
      html += createQueueItem(track, false);
    });
  }

  queueList.innerHTML = html;
}

function createQueueItem(track, isCurrentlyPlaying) {
  const imageUrl = track.album?.images?.[0]?.url || '';
  const trackName = track.name || 'Unknown Track';
  const artistName = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
  const currentClass = isCurrentlyPlaying ? 'currently-playing' : '';

  return `
    <div class="queue-item ${currentClass}">
      ${imageUrl ? `<img src="${imageUrl}" alt="${trackName}" class="queue-image">` : '<div class="queue-image"></div>'}
      <div class="queue-info">
        <div class="queue-name">${trackName}</div>
        <div class="queue-artist">${artistName}</div>
      </div>
    </div>
  `;
}

// Search functionality
searchBtn.addEventListener('click', () => {
  searchModal.classList.remove('hidden');
  searchInput.value = '';
  searchResults.innerHTML = `
    <div class="playlist-loading">
      <p>Search for a track to add to queue</p>
    </div>
  `;
  setTimeout(() => searchInput.focus(), 100);
});

closeSearchModalBtn.addEventListener('click', () => {
  searchModal.classList.add('hidden');
});

// Close search modal when clicking outside
searchModal.addEventListener('click', (e) => {
  if (e.target === searchModal) {
    searchModal.classList.add('hidden');
  }
});

// Search on button click
searchSubmitBtn.addEventListener('click', () => {
  performSearch();
});

// Search on Enter key
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performSearch();
  }
});

async function performSearch() {
  const query = searchInput.value.trim();

  if (!query) {
    searchResults.innerHTML = `
      <div class="playlist-loading">
        <p style="color: #ff6b6b;">Please enter a search term</p>
      </div>
    `;
    return;
  }

  try {
    // Show loading state
    searchResults.innerHTML = `
      <div class="playlist-loading">
        <div class="spinner"></div>
        <p>Searching...</p>
      </div>
    `;

    const response = await browser.runtime.sendMessage({
      action: 'searchTracks',
      query: query,
      limit: 20
    });

    console.log('Search response:', response);

    if (!response || !response.success) {
      searchResults.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">Search failed: ${response?.error || 'Unknown error'}</p>
        </div>
      `;
      return;
    }

    if (!response.data || !response.data.tracks || !response.data.tracks.items) {
      searchResults.innerHTML = `
        <div class="playlist-loading">
          <p style="color: #ff6b6b;">No data received from search</p>
        </div>
      `;
      return;
    }

    displaySearchResults(response.data.tracks.items);
  } catch (error) {
    console.error('Search error:', error);
    searchResults.innerHTML = `
      <div class="playlist-loading">
        <p style="color: #ff6b6b;">Error: ${error.message || 'Unknown error'}</p>
      </div>
    `;
  }
}

function displaySearchResults(tracks) {
  if (!tracks || tracks.length === 0) {
    searchResults.innerHTML = `
      <div class="playlist-loading">
        <p>No tracks found</p>
      </div>
    `;
    return;
  }

  searchResults.innerHTML = tracks.map(track => {
    const imageUrl = track.album?.images?.[0]?.url || '';
    const trackName = track.name || 'Unknown Track';
    const artistName = track.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
    const trackUri = track.uri || '';

    return `
      <div class="search-item" data-uri="${trackUri}">
        ${imageUrl ? `<img src="${imageUrl}" alt="${trackName}" class="search-image">` : '<div class="search-image"></div>'}
        <div class="search-info">
          <div class="search-name">${trackName}</div>
          <div class="search-artist">${artistName}</div>
        </div>
        <button class="add-to-queue-btn" data-uri="${trackUri}">Add</button>
      </div>
    `;
  }).join('');

  // Add click handlers to add buttons
  document.querySelectorAll('.add-to-queue-btn').forEach(button => {
    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      const trackUri = button.getAttribute('data-uri');
      await addTrackToQueue(trackUri, button);
    });
  });
}

async function addTrackToQueue(trackUri, button) {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'addToQueue',
      trackUri: trackUri
    });

    if (response && response.success) {
      // Update button to show success
      button.textContent = 'Added!';
      button.classList.add('added');
      button.disabled = true;

      // Show brief success message
      setTimeout(() => {
        if (button.textContent === 'Added!') {
          button.textContent = 'Add';
          button.classList.remove('added');
          button.disabled = false;
        }
      }, 2000);
    } else {
      showError('Failed to add to queue: ' + (response?.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Add to queue error:', error);
    showError('Failed to add to queue: ' + error.message);
  }
}

// Initialize
init();
