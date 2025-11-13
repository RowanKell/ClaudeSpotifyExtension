// Main UI logic for Smart Playlists

// DOM Elements
const loadingSection = document.getElementById('loading-section');
const trainingModeSection = document.getElementById('training-mode-section');
const inferenceModeSection = document.getElementById('inference-mode-section');
const errorMessage = document.getElementById('error-message');

// Training mode elements
const sessionCount = document.getElementById('session-count');
const minSessions = document.getElementById('min-sessions');
const progressFill = document.getElementById('progress-fill');
const switchToInferenceBtn = document.getElementById('switch-to-inference-btn');

const taskInput = document.getElementById('task-input');
const playlistSelect = document.getElementById('playlist-select');
const startSessionBtn = document.getElementById('start-session-btn');

const newSessionCard = document.getElementById('new-session-card');
const activeSessionCard = document.getElementById('active-session-card');
const activeTask = document.getElementById('active-task');
const activePlaylist = document.getElementById('active-playlist');
const sessionDuration = document.getElementById('session-duration');
const tracksPlayed = document.getElementById('tracks-played');
const pauseSessionBtn = document.getElementById('pause-session-btn');
const endSessionBtn = document.getElementById('end-session-btn');

const trainingHistory = document.getElementById('training-history');

// Inference mode elements
const totalSessions = document.getElementById('total-sessions');
const switchToTrainingBtn = document.getElementById('switch-to-training-btn');
const recommendationInput = document.getElementById('recommendation-input');
const getRecommendationsBtn = document.getElementById('get-recommendations-btn');
const recommendationsCard = document.getElementById('recommendations-card');
const recommendationsList = document.getElementById('recommendations-list');

// Back button
const backBtn = document.getElementById('back-btn');

// State
let currentMode = 'training';
let userPlaylists = [];
let durationUpdateInterval = null;

// Initialize
async function init() {
  try {
    showLoading();

    // Initialize IndexedDB
    await dataManager.init();

    // Load playlists
    await loadPlaylists();

    // Check metadata and determine mode
    const metadata = await dataManager.getModelMetadata();
    currentMode = metadata.mode;

    // Update UI based on mode
    updateUI(metadata);

    hideLoading();
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to initialize. Please try again.');
    hideLoading();
  }
}

// Load user playlists from Spotify
async function loadPlaylists() {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'getUserPlaylists',
      limit: 50,
      offset: 0
    });

    if (response && response.success && response.data && response.data.items) {
      userPlaylists = response.data.items;

      // Add Liked Songs option
      userPlaylists.unshift({
        uri: 'liked-songs',
        name: 'Liked Songs',
        images: []
      });

      populatePlaylistSelect();
    } else {
      throw new Error('Failed to load playlists');
    }
  } catch (error) {
    console.error('Error loading playlists:', error);
    showError('Failed to load playlists. Please make sure you\'re logged into Spotify.');
  }
}

// Populate playlist dropdown
function populatePlaylistSelect() {
  playlistSelect.innerHTML = '<option value="">Choose a playlist...</option>';

  for (const playlist of userPlaylists) {
    const option = document.createElement('option');
    option.value = playlist.uri;
    option.textContent = playlist.name;
    playlistSelect.appendChild(option);
  }
}

// Update UI based on current mode and metadata
async function updateUI(metadata) {
  const sessions = await dataManager.getAllSessions();

  // Update session count
  sessionCount.textContent = sessions.length;
  minSessions.textContent = metadata.minSessionsForInference;
  totalSessions.textContent = sessions.length;

  // Update progress bar
  const progress = Math.min(100, (sessions.length / metadata.minSessionsForInference) * 100);
  progressFill.style.width = `${progress}%`;

  // Show appropriate section
  if (currentMode === 'training') {
    showTrainingMode();

    // Show switch button if ready
    if (sessions.length >= metadata.minSessionsForInference) {
      switchToInferenceBtn.classList.remove('hidden');
    }
  } else {
    showInferenceMode();
  }

  // Load training history
  await loadTrainingHistory();

  // Check if there's an active session
  if (sessionTracker.isActive()) {
    showActiveSession();
    startDurationUpdate();
  }
}

// Show/hide sections
function showLoading() {
  loadingSection.classList.remove('hidden');
  trainingModeSection.classList.add('hidden');
  inferenceModeSection.classList.add('hidden');
}

function hideLoading() {
  loadingSection.classList.add('hidden');
}

function showTrainingMode() {
  trainingModeSection.classList.remove('hidden');
  inferenceModeSection.classList.add('hidden');
  currentMode = 'training';
}

function showInferenceMode() {
  trainingModeSection.classList.add('hidden');
  inferenceModeSection.classList.remove('hidden');
  currentMode = 'inference';
}

// Show error message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');

  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}

// Load and display training history
async function loadTrainingHistory() {
  try {
    const sessions = await dataManager.getRecentSessions(10);

    if (sessions.length === 0) {
      trainingHistory.innerHTML = `
        <div class="empty-state">
          <p>No training sessions yet. Start your first session above!</p>
        </div>
      `;
      return;
    }

    trainingHistory.innerHTML = sessions.map(session => {
      const date = new Date(session.startTime).toLocaleDateString();
      const duration = sessionTracker.formatDuration(session.duration || 0);

      return `
        <div class="history-item">
          <div class="history-header">
            <div class="history-task">"${session.taskDescription}"</div>
            <div class="history-date">${date}</div>
          </div>
          <div class="history-playlist">🎵 ${session.playlistName}</div>
          <div class="history-meta">
            <span>⏱ ${duration}</span>
            <span>🎵 ${session.tracksPlayed || 0} tracks</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading training history:', error);
  }
}

// Enable/disable start session button
taskInput.addEventListener('input', () => {
  updateStartButtonState();
});

playlistSelect.addEventListener('change', () => {
  updateStartButtonState();
});

function updateStartButtonState() {
  const hasTask = taskInput.value.trim().length > 0;
  const hasPlaylist = playlistSelect.value !== '';

  startSessionBtn.disabled = !(hasTask && hasPlaylist);
}

// Start training session
startSessionBtn.addEventListener('click', async () => {
  const taskDescription = taskInput.value.trim();
  const playlistUri = playlistSelect.value;

  if (!taskDescription || !playlistUri) {
    return;
  }

  try {
    // Find playlist details
    const playlist = userPlaylists.find(p => p.uri === playlistUri);
    if (!playlist) {
      showError('Playlist not found');
      return;
    }

    // Start the session
    sessionTracker.startSession(
      taskDescription,
      playlistUri,
      playlist.name,
      playlist.images?.[0]?.url || ''
    );

    // Start playing the playlist
    if (playlistUri === 'liked-songs') {
      await browser.runtime.sendMessage({ action: 'playLikedSongs' });
    } else {
      await browser.runtime.sendMessage({
        action: 'startPlaylist',
        playlistUri: playlistUri
      });
    }

    // Update UI
    showActiveSession();
    startDurationUpdate();

    // Clear inputs
    taskInput.value = '';
    playlistSelect.value = '';
    updateStartButtonState();
  } catch (error) {
    console.error('Error starting session:', error);
    showError('Failed to start session. Please try again.');
  }
});

// Show active session UI
function showActiveSession() {
  const session = sessionTracker.getActiveSession();

  if (!session) {
    return;
  }

  newSessionCard.classList.add('hidden');
  activeSessionCard.classList.remove('hidden');

  activeTask.textContent = session.taskDescription;
  activePlaylist.textContent = session.playlistName;
  sessionDuration.textContent = sessionTracker.formatDuration(session.currentDuration);
  tracksPlayed.textContent = session.tracksPlayed;

  // Update pause button text
  pauseSessionBtn.textContent = session.isPaused ? 'Resume Session' : 'Pause Session';
}

// Hide active session UI
function hideActiveSession() {
  newSessionCard.classList.remove('hidden');
  activeSessionCard.classList.add('hidden');
  stopDurationUpdate();
}

// Start updating duration display
function startDurationUpdate() {
  stopDurationUpdate();

  durationUpdateInterval = setInterval(() => {
    const session = sessionTracker.getActiveSession();
    if (session) {
      sessionDuration.textContent = sessionTracker.formatDuration(session.currentDuration);
      tracksPlayed.textContent = session.tracksPlayed;
    }
  }, 1000);
}

// Stop updating duration display
function stopDurationUpdate() {
  if (durationUpdateInterval) {
    clearInterval(durationUpdateInterval);
    durationUpdateInterval = null;
  }
}

// Pause/Resume session
pauseSessionBtn.addEventListener('click', () => {
  if (sessionTracker.isPaused()) {
    sessionTracker.resumeSession();
    pauseSessionBtn.textContent = 'Pause Session';
  } else {
    sessionTracker.pauseSession();
    pauseSessionBtn.textContent = 'Resume Session';
  }
});

// End session
endSessionBtn.addEventListener('click', async () => {
  try {
    // Save the session
    await sessionTracker.endSession();

    // Update UI
    hideActiveSession();
    await loadTrainingHistory();

    // Update metadata and progress
    const metadata = await dataManager.getModelMetadata();
    await updateUI(metadata);

    showError('Training session saved successfully!');
  } catch (error) {
    console.error('Error ending session:', error);
    showError('Failed to save session. Please try again.');
  }
});

// Switch modes
switchToInferenceBtn.addEventListener('click', () => {
  currentMode = 'inference';
  showInferenceMode();
});

switchToTrainingBtn.addEventListener('click', () => {
  currentMode = 'training';
  showTrainingMode();
});

// Get recommendations
getRecommendationsBtn.addEventListener('click', async () => {
  const query = recommendationInput.value.trim();

  if (!query) {
    showError('Please describe what you\'re working on');
    return;
  }

  try {
    // Show loading state
    recommendationsCard.classList.remove('hidden');
    recommendationsList.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Finding the perfect playlists...</p>
      </div>
    `;

    // Get all sessions
    const sessions = await dataManager.getAllSessions();

    // Get recommendations
    const recommendations = await mlEngine.getRecommendations(query, sessions, 5);

    if (recommendations.length === 0) {
      recommendationsList.innerHTML = `
        <div class="empty-state">
          <p>No recommendations found. Try a different description or add more training sessions.</p>
        </div>
      `;
      return;
    }

    // Display recommendations
    displayRecommendations(recommendations);
  } catch (error) {
    console.error('Error getting recommendations:', error);
    showError('Failed to get recommendations. Please try again.');
  }
});

// Display recommendations
function displayRecommendations(recommendations) {
  recommendationsList.innerHTML = recommendations.map((rec, index) => {
    const matchPercent = Math.round(rec.avgScore * 100);
    const imageUrl = rec.playlistImage || '';

    return `
      <div class="recommendation-item">
        <div class="recommendation-rank">${index + 1}</div>
        ${imageUrl ? `<img src="${imageUrl}" alt="${rec.playlistName}" class="recommendation-image">` : '<div class="recommendation-image"></div>'}
        <div class="recommendation-info">
          <div class="recommendation-name">${rec.playlistName}</div>
          <div class="recommendation-meta">
            <span class="match-score">${matchPercent}% match</span>
            <span>•</span>
            <span>Used ${rec.timesUsed} time${rec.timesUsed !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="recommendation-actions">
          <button class="icon-btn play-btn" data-uri="${rec.playlistUri}" title="Play">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
          <button class="icon-btn thumbs-up" data-uri="${rec.playlistUri}" title="Like">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
            </svg>
          </button>
          <button class="icon-btn thumbs-down" data-uri="${rec.playlistUri}" title="Dislike">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners to play buttons
  document.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const uri = btn.getAttribute('data-uri');
      await playPlaylist(uri);
    });
  });

  // Add event listeners to feedback buttons
  document.querySelectorAll('.thumbs-up').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const uri = btn.getAttribute('data-uri');
      await handleFeedback(uri, true, btn);
    });
  });

  document.querySelectorAll('.thumbs-down').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const uri = btn.getAttribute('data-uri');
      await handleFeedback(uri, false, btn);
    });
  });
}

// Play a playlist
async function playPlaylist(playlistUri) {
  try {
    if (playlistUri === 'liked-songs') {
      await browser.runtime.sendMessage({ action: 'playLikedSongs' });
    } else {
      await browser.runtime.sendMessage({
        action: 'startPlaylist',
        playlistUri: playlistUri
      });
    }

    showError('Playing playlist...');
  } catch (error) {
    console.error('Error playing playlist:', error);
    showError('Failed to play playlist. Please try again.');
  }
}

// Handle feedback
async function handleFeedback(playlistUri, isPositive, button) {
  try {
    const query = recommendationInput.value.trim();
    await mlEngine.processFeedback(query, playlistUri, isPositive);

    // Visual feedback
    button.classList.add('active');

    // Remove active class from sibling button
    const parent = button.parentElement;
    const sibling = isPositive ?
      parent.querySelector('.thumbs-down') :
      parent.querySelector('.thumbs-up');

    if (sibling) {
      sibling.classList.remove('active');
    }

    showError(isPositive ? 'Thanks for the feedback!' : 'Feedback noted');
  } catch (error) {
    console.error('Error processing feedback:', error);
  }
}

// Back button
backBtn.addEventListener('click', () => {
  // Navigate back to popup
  window.location.href = '../popup/popup.html';
});

// Initialize on load
window.addEventListener('load', init);

// Clean up on unload
window.addEventListener('unload', () => {
  stopDurationUpdate();
});
