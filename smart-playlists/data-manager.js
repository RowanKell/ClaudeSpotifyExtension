// IndexedDB Manager for Smart Playlists
// Handles all data storage and retrieval operations

const DB_NAME = 'SpotifyMLExtension';
const DB_VERSION = 1;
const TRAINING_STORE = 'trainingSessions';
const MODEL_STORE = 'modelData';

class DataManager {
  constructor() {
    this.db = null;
  }

  // Initialize IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create training sessions store
        if (!db.objectStoreNames.contains(TRAINING_STORE)) {
          const sessionStore = db.createObjectStore(TRAINING_STORE, { keyPath: 'id' });
          sessionStore.createIndex('taskDescription', 'taskDescription', { unique: false });
          sessionStore.createIndex('playlistUri', 'playlistUri', { unique: false });
          sessionStore.createIndex('startTime', 'startTime', { unique: false });
          console.log('Created training sessions object store');
        }

        // Create model data store
        if (!db.objectStoreNames.contains(MODEL_STORE)) {
          db.createObjectStore(MODEL_STORE, { keyPath: 'key' });
          console.log('Created model data object store');
        }
      };
    });
  }

  // Save a training session
  async saveSession(session) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TRAINING_STORE], 'readwrite');
      const store = transaction.objectStore(TRAINING_STORE);

      // Add ID and timestamp if not present
      if (!session.id) {
        session.id = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
      }
      if (!session.startTime) {
        session.startTime = Date.now();
      }

      const request = store.put(session);

      request.onsuccess = () => {
        console.log('Session saved:', session.id);
        resolve(session);
      };

      request.onerror = () => {
        console.error('Error saving session:', request.error);
        reject(request.error);
      };
    });
  }

  // Get all training sessions
  async getAllSessions() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TRAINING_STORE], 'readonly');
      const store = transaction.objectStore(TRAINING_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = request.result || [];
        // Sort by start time, newest first
        sessions.sort((a, b) => b.startTime - a.startTime);
        resolve(sessions);
      };

      request.onerror = () => {
        console.error('Error getting sessions:', request.error);
        reject(request.error);
      };
    });
  }

  // Get recent sessions (limit)
  async getRecentSessions(limit = 10) {
    const allSessions = await this.getAllSessions();
    return allSessions.slice(0, limit);
  }

  // Get sessions by playlist URI
  async getSessionsByPlaylist(playlistUri) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TRAINING_STORE], 'readonly');
      const store = transaction.objectStore(TRAINING_STORE);
      const index = store.index('playlistUri');
      const request = index.getAll(playlistUri);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('Error getting sessions by playlist:', request.error);
        reject(request.error);
      };
    });
  }

  // Delete a session
  async deleteSession(sessionId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TRAINING_STORE], 'readwrite');
      const store = transaction.objectStore(TRAINING_STORE);
      const request = store.delete(sessionId);

      request.onsuccess = () => {
        console.log('Session deleted:', sessionId);
        resolve();
      };

      request.onerror = () => {
        console.error('Error deleting session:', request.error);
        reject(request.error);
      };
    });
  }

  // Save model metadata
  async saveModelMetadata(metadata) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MODEL_STORE], 'readwrite');
      const store = transaction.objectStore(MODEL_STORE);
      const request = store.put({ key: 'metadata', ...metadata });

      request.onsuccess = () => {
        console.log('Model metadata saved');
        resolve();
      };

      request.onerror = () => {
        console.error('Error saving metadata:', request.error);
        reject(request.error);
      };
    });
  }

  // Get model metadata
  async getModelMetadata() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([MODEL_STORE], 'readonly');
      const store = transaction.objectStore(MODEL_STORE);
      const request = store.get('metadata');

      request.onsuccess = () => {
        const metadata = request.result || {
          key: 'metadata',
          version: '1.0.0',
          totalSessions: 0,
          lastTrained: null,
          minSessionsForInference: 10,
          mode: 'training'
        };
        resolve(metadata);
      };

      request.onerror = () => {
        console.error('Error getting metadata:', request.error);
        reject(request.error);
      };
    });
  }

  // Update session count in metadata
  async updateSessionCount() {
    const sessions = await this.getAllSessions();
    const metadata = await this.getModelMetadata();
    metadata.totalSessions = sessions.length;

    // Update mode based on session count
    if (metadata.totalSessions >= metadata.minSessionsForInference) {
      metadata.mode = 'ready';
    } else {
      metadata.mode = 'training';
    }

    await this.saveModelMetadata(metadata);
    return metadata;
  }

  // Clear all data (for testing or reset)
  async clearAllData() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TRAINING_STORE, MODEL_STORE], 'readwrite');

      const sessionsRequest = transaction.objectStore(TRAINING_STORE).clear();
      const modelRequest = transaction.objectStore(MODEL_STORE).clear();

      transaction.oncomplete = () => {
        console.log('All data cleared');
        resolve();
      };

      transaction.onerror = () => {
        console.error('Error clearing data:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  // Export data (for backup)
  async exportData() {
    const sessions = await this.getAllSessions();
    const metadata = await this.getModelMetadata();

    return {
      sessions,
      metadata,
      exportDate: new Date().toISOString(),
      version: DB_VERSION
    };
  }

  // Import data (from backup)
  async importData(data) {
    if (!data.sessions || !data.metadata) {
      throw new Error('Invalid import data format');
    }

    // Clear existing data
    await this.clearAllData();

    // Import sessions
    for (const session of data.sessions) {
      await this.saveSession(session);
    }

    // Import metadata
    await this.saveModelMetadata(data.metadata);

    console.log('Data imported successfully');
  }
}

// Create global instance
const dataManager = new DataManager();
