// Session Tracker for monitoring active training sessions with track-level data

class SessionTracker {
  constructor() {
    this.activeSession = null;
    this.startTime = null;
    this.pauseTime = null;
    this.totalPausedDuration = 0;
    this.updateInterval = null;
    this.lastTrackUri = null;
    this.lastContextUri = null;
    this.tracksHistory = []; // Complete history of tracks played
    this.playlistsSwitched = new Set(); // Track playlists switched to
  }

  // Start a new training session
  startSession(taskDescription, playlistUri, playlistName, playlistImage) {
    this.activeSession = {
      id: null, // Will be set when saved
      taskDescription,
      initialPlaylistUri: playlistUri,
      initialPlaylistName: playlistName,
      playlistImage,
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      tracks: [], // Array of track objects with full details
      playlistsSwitched: [], // Array of playlist URIs switched to during session
      completed: false,
      rating: null,
      taskKeywords: mlEngine.extractKeywords(taskDescription)
    };

    this.startTime = Date.now();
    this.pauseTime = null;
    this.totalPausedDuration = 0;
    this.lastTrackUri = null;
    this.lastContextUri = playlistUri;
    this.tracksHistory = [];
    this.playlistsSwitched = new Set([playlistUri]);

    // Start monitoring playback
    this.startMonitoring();

    console.log('Training session started:', this.activeSession);

    return this.activeSession;
  }

  // Start monitoring Spotify playback
  startMonitoring() {
    if (this.updateInterval) {
      return;
    }

    // Update every 3 seconds to capture track changes
    this.updateInterval = setInterval(async () => {
      await this.checkPlayback();
    }, 3000);
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Check current playback state and capture track data
  async checkPlayback() {
    try {
      const response = await browser.runtime.sendMessage({
        action: 'getCurrentPlayback'
      });

      if (response && response.success && response.data) {
        const data = response.data;

        // Check if context (playlist/album) has changed
        const currentContextUri = data.context?.uri || null;
        if (currentContextUri && currentContextUri !== this.lastContextUri) {
          console.log('User switched context:', currentContextUri);
          this.playlistsSwitched.add(currentContextUri);
          this.lastContextUri = currentContextUri;
        }

        // Capture track details
        if (data.item && data.item.uri !== this.lastTrackUri) {
          const track = {
            uri: data.item.uri,
            id: data.item.id,
            name: data.item.name,
            artists: data.item.artists.map(a => ({
              name: a.name,
              id: a.id
            })),
            album: {
              name: data.item.album.name,
              id: data.item.album.id,
              images: data.item.album.images
            },
            durationMs: data.item.duration_ms,
            playedAt: Date.now(),
            contextUri: currentContextUri,
            audioFeatures: null // Will be fetched later in batch
          };

          this.tracksHistory.push(track);
          this.lastTrackUri = data.item.uri;

          console.log('Track captured:', track.name, 'by', track.artists.map(a => a.name).join(', '));
        }
      }
    } catch (error) {
      console.error('Error checking playback:', error);
    }
  }

  // Pause the session
  pauseSession() {
    if (!this.pauseTime) {
      this.pauseTime = Date.now();
      this.stopMonitoring();
      console.log('Session paused');
    }
  }

  // Resume the session
  resumeSession() {
    if (this.pauseTime) {
      const pauseDuration = Date.now() - this.pauseTime;
      this.totalPausedDuration += pauseDuration;
      this.pauseTime = null;
      this.startMonitoring();
      console.log('Session resumed');
    }
  }

  // End and save the session with audio features
  async endSession(rating = null) {
    this.stopMonitoring();

    const endTime = Date.now();
    const totalElapsed = endTime - this.startTime;
    const activeDuration = totalElapsed - this.totalPausedDuration;

    // Update session data
    this.activeSession.endTime = endTime;
    this.activeSession.duration = Math.floor(activeDuration / 1000); // Convert to seconds
    this.activeSession.tracks = this.tracksHistory;
    this.activeSession.playlistsSwitched = Array.from(this.playlistsSwitched);
    this.activeSession.completed = true;
    this.activeSession.rating = rating;

    // Fetch audio features for all tracks
    console.log('Fetching audio features for', this.tracksHistory.length, 'tracks...');
    await this.fetchAudioFeatures();

    // Save to IndexedDB
    try {
      const savedSession = await dataManager.saveSession(this.activeSession);

      // Update metadata
      await dataManager.updateSessionCount();

      console.log('Session saved with', this.tracksHistory.length, 'tracks');

      // Reset tracker
      this.reset();

      return savedSession;
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  }

  // Fetch audio features for all tracks in batch
  async fetchAudioFeatures() {
    if (this.tracksHistory.length === 0) {
      return;
    }

    try {
      // Extract track IDs
      const trackIds = this.tracksHistory.map(track => track.id);

      // Fetch audio features in batch
      const response = await browser.runtime.sendMessage({
        action: 'getAudioFeatures',
        trackIds: trackIds
      });

      if (response && response.success && response.data && response.data.audio_features) {
        const features = response.data.audio_features;

        // Map features back to tracks
        for (let i = 0; i < this.tracksHistory.length; i++) {
          if (features[i]) {
            this.tracksHistory[i].audioFeatures = {
              energy: features[i].energy,
              valence: features[i].valence,
              danceability: features[i].danceability,
              acousticness: features[i].acousticness,
              instrumentalness: features[i].instrumentalness,
              tempo: features[i].tempo,
              loudness: features[i].loudness,
              speechiness: features[i].speechiness
            };
          }
        }

        console.log('Audio features fetched for', features.filter(f => f !== null).length, 'tracks');
      } else if (response && !response.success) {
        // Log the specific error
        console.warn('Audio features unavailable:', response.message || response.error);
        console.log('Session will be saved without audio features. Recommendations may be slightly less accurate.');
      }
    } catch (error) {
      console.error('Error fetching audio features:', error);
      // Continue without audio features - they're optional
    }
  }

  // Cancel the session without saving
  cancelSession() {
    this.stopMonitoring();
    this.reset();
    console.log('Session cancelled');
  }

  // Reset tracker state
  reset() {
    this.activeSession = null;
    this.startTime = null;
    this.pauseTime = null;
    this.totalPausedDuration = 0;
    this.lastTrackUri = null;
    this.lastContextUri = null;
    this.tracksHistory = [];
    this.playlistsSwitched = new Set();
  }

  // Get current session duration
  getCurrentDuration() {
    if (!this.startTime) {
      return 0;
    }

    const now = this.pauseTime || Date.now();
    const totalElapsed = now - this.startTime;
    const activeDuration = totalElapsed - this.totalPausedDuration;

    return Math.floor(activeDuration / 1000); // Seconds
  }

  // Format duration for display (HH:MM:SS or MM:SS)
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  // Get session status
  isActive() {
    return this.activeSession !== null;
  }

  isPaused() {
    return this.pauseTime !== null;
  }

  // Get active session data
  getActiveSession() {
    if (!this.activeSession) {
      return null;
    }

    return {
      ...this.activeSession,
      currentDuration: this.getCurrentDuration(),
      tracksCount: this.tracksHistory.length,
      playlistsSwitchedCount: this.playlistsSwitched.size,
      isPaused: this.isPaused()
    };
  }
}

// Create global instance
const sessionTracker = new SessionTracker();
