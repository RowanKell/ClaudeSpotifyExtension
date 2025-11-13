// Session Tracker for monitoring active training sessions

class SessionTracker {
  constructor() {
    this.activeSession = null;
    this.startTime = null;
    this.pauseTime = null;
    this.totalPausedDuration = 0;
    this.tracksPlayed = 0;
    this.updateInterval = null;
    this.lastTrackUri = null;
  }

  // Start a new training session
  startSession(taskDescription, playlistUri, playlistName, playlistImage) {
    this.activeSession = {
      id: null, // Will be set when saved
      taskDescription,
      playlistUri,
      playlistName,
      playlistImage,
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      tracksPlayed: 0,
      completed: false,
      rating: null,
      taskKeywords: mlEngine.extractKeywords(taskDescription)
    };

    this.startTime = Date.now();
    this.pauseTime = null;
    this.totalPausedDuration = 0;
    this.tracksPlayed = 0;
    this.lastTrackUri = null;

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

    // Update every 3 seconds
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

  // Check current playback state
  async checkPlayback() {
    try {
      const response = await browser.runtime.sendMessage({
        action: 'getCurrentPlayback'
      });

      if (response && response.success && response.data) {
        const data = response.data;

        // Check if currently playing from our session's playlist
        if (data.context && data.context.uri === this.activeSession.playlistUri) {
          // Track unique songs played
          if (data.item && data.item.uri !== this.lastTrackUri) {
            this.lastTrackUri = data.item.uri;
            this.tracksPlayed++;
            this.activeSession.tracksPlayed = this.tracksPlayed;
          }
        } else {
          // User switched to a different playlist
          console.log('User switched playlist during training session');
          // Could auto-pause the session here
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

  // End and save the session
  async endSession(rating = null) {
    this.stopMonitoring();

    const endTime = Date.now();
    const totalElapsed = endTime - this.startTime;
    const activeDuration = totalElapsed - this.totalPausedDuration;

    // Update session data
    this.activeSession.endTime = endTime;
    this.activeSession.duration = Math.floor(activeDuration / 1000); // Convert to seconds
    this.activeSession.tracksPlayed = this.tracksPlayed;
    this.activeSession.completed = true;
    this.activeSession.rating = rating;

    // Save to IndexedDB
    try {
      const savedSession = await dataManager.saveSession(this.activeSession);

      // Update metadata
      await dataManager.updateSessionCount();

      console.log('Session saved:', savedSession);

      // Reset tracker
      this.reset();

      return savedSession;
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
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
    this.tracksPlayed = 0;
    this.lastTrackUri = null;
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
      isPaused: this.isPaused()
    };
  }
}

// Create global instance
const sessionTracker = new SessionTracker();
