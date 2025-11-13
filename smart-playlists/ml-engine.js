// ML Engine for Smart Playlist Recommendations with Track-Level Analysis
// Implements TF-IDF + Audio Feature Similarity + Track Frequency Analysis

class MLEngine {
  constructor() {
    this.stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'i', 'am', 'my', 'me', 'we', 'us',
      'you', 'your', 'some', 'this', 'what', 'which', 'who', 'when',
      'where', 'why', 'how', 'all', 'each', 'every', 'can', 'could',
      'should', 'would', 'may', 'might', 'must', 'shall', 'will'
    ]);
  }

  // Preprocess text: lowercase, remove punctuation, tokenize, remove stop words
  preprocessText(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const cleaned = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(token => token.length > 0);
    const filtered = tokens.filter(token => !this.stopWords.has(token));

    return filtered;
  }

  // Calculate term frequency for a document
  calculateTF(tokens) {
    const tf = {};
    const totalTokens = tokens.length;

    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1;
    }

    for (const token in tf) {
      tf[token] = tf[token] / totalTokens;
    }

    return tf;
  }

  // Calculate inverse document frequency
  calculateIDF(documents) {
    const idf = {};
    const totalDocs = documents.length;

    const docFrequency = {};
    for (const doc of documents) {
      const uniqueTokens = new Set(doc.tokens);
      for (const token of uniqueTokens) {
        docFrequency[token] = (docFrequency[token] || 0) + 1;
      }
    }

    for (const token in docFrequency) {
      idf[token] = Math.log(totalDocs / docFrequency[token]);
    }

    return idf;
  }

  // Calculate TF-IDF vector for a document
  calculateTFIDF(tokens, idf) {
    const tf = this.calculateTF(tokens);
    const tfidf = {};

    for (const token in tf) {
      tfidf[token] = tf[token] * (idf[token] || 0);
    }

    return tfidf;
  }

  // Calculate cosine similarity between two vectors
  cosineSimilarity(vec1, vec2) {
    const allKeys = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const key of allKeys) {
      const val1 = vec1[key] || 0;
      const val2 = vec2[key] || 0;

      dotProduct += val1 * val2;
      magnitude1 += val1 * val1;
      magnitude2 += val2 * val2;
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  // Calculate audio feature similarity between two tracks
  audioFeatureSimilarity(features1, features2) {
    if (!features1 || !features2) {
      return 0.5; // Neutral score if features missing
    }

    // Normalize and calculate euclidean distance
    const keys = ['energy', 'valence', 'danceability', 'acousticness', 'instrumentalness'];
    let sumSquaredDiff = 0;

    for (const key of keys) {
      const val1 = features1[key] || 0;
      const val2 = features2[key] || 0;
      sumSquaredDiff += Math.pow(val1 - val2, 2);
    }

    const euclideanDistance = Math.sqrt(sumSquaredDiff);

    // Convert distance to similarity (0-1 scale, closer = higher)
    // Max possible distance is sqrt(5) = 2.236
    const similarity = 1 - (euclideanDistance / 2.236);

    return Math.max(0, Math.min(1, similarity));
  }

  // Get average audio features for a collection of tracks
  getAverageAudioFeatures(tracks) {
    const tracksWithFeatures = tracks.filter(t => t.audioFeatures);

    if (tracksWithFeatures.length === 0) {
      return null;
    }

    const avg = {
      energy: 0,
      valence: 0,
      danceability: 0,
      acousticness: 0,
      instrumentalness: 0,
      tempo: 0
    };

    for (const track of tracksWithFeatures) {
      for (const key in avg) {
        avg[key] += track.audioFeatures[key] || 0;
      }
    }

    for (const key in avg) {
      avg[key] /= tracksWithFeatures.length;
    }

    return avg;
  }

  // Get track recommendations based on task description and audio features
  async getTrackRecommendations(taskDescription, sessions, limit = 50) {
    if (!sessions || sessions.length === 0) {
      return [];
    }

    // Step 1: Find similar sessions using TF-IDF
    const queryTokens = this.preprocessText(taskDescription);
    if (queryTokens.length === 0) {
      return [];
    }

    const documents = sessions.map(session => ({
      session,
      tokens: this.preprocessText(session.taskDescription)
    })).filter(doc => doc.tokens.length > 0);

    if (documents.length === 0) {
      return [];
    }

    const idf = this.calculateIDF(documents);
    const queryTFIDF = this.calculateTFIDF(queryTokens, idf);

    // Calculate session similarities
    const sessionSimilarities = documents.map(doc => {
      const docTFIDF = this.calculateTFIDF(doc.tokens, idf);
      const similarity = this.cosineSimilarity(queryTFIDF, docTFIDF);

      return {
        session: doc.session,
        similarity
      };
    });

    // Sort by similarity and take top sessions (focus on most similar tasks)
    sessionSimilarities.sort((a, b) => b.similarity - a.similarity);
    const topSessions = sessionSimilarities.slice(0, Math.max(5, Math.ceil(sessions.length * 0.3)));

    // Step 2: Extract all tracks from similar sessions
    const trackScores = new Map();

    for (const { session, similarity } of topSessions) {
      if (!session.tracks || session.tracks.length === 0) {
        continue;
      }

      for (const track of session.tracks) {
        if (!trackScores.has(track.uri)) {
          trackScores.set(track.uri, {
            track,
            frequency: 0,
            taskSimilaritySum: 0,
            sessionCount: 0
          });
        }

        const score = trackScores.get(track.uri);
        score.frequency++;
        score.taskSimilaritySum += similarity;
        score.sessionCount++;
      }
    }

    // Step 3: Calculate average audio features from top sessions
    const allTracksFromTopSessions = topSessions.flatMap(s => s.session.tracks || []);
    const targetAudioFeatures = this.getAverageAudioFeatures(allTracksFromTopSessions);

    // Step 4: Score each track
    const scoredTracks = Array.from(trackScores.values()).map(item => {
      const avgTaskSimilarity = item.taskSimilaritySum / item.sessionCount;
      const frequencyScore = Math.min(1, item.frequency / 5); // Normalize frequency

      // Calculate audio feature similarity
      let audioScore = 0.5;
      if (targetAudioFeatures && item.track.audioFeatures) {
        audioScore = this.audioFeatureSimilarity(targetAudioFeatures, item.track.audioFeatures);
      }

      // Weighted final score: 40% task similarity, 30% frequency, 30% audio features
      const finalScore = (avgTaskSimilarity * 0.4) + (frequencyScore * 0.3) + (audioScore * 0.3);

      return {
        ...item.track,
        score: finalScore,
        frequency: item.frequency,
        taskSimilarity: avgTaskSimilarity,
        audioSimilarity: audioScore
      };
    });

    // Sort by score and return top tracks
    scoredTracks.sort((a, b) => b.score - a.score);

    return scoredTracks.slice(0, limit);
  }

  // Get playlist recommendations (legacy method, now enhanced)
  async getRecommendations(taskDescription, sessions, limit = 5) {
    if (!sessions || sessions.length === 0) {
      return [];
    }

    // Get track recommendations first
    const trackRecommendations = await this.getTrackRecommendations(taskDescription, sessions, 100);

    if (trackRecommendations.length === 0) {
      return [];
    }

    // Group tracks by playlist/context
    const playlistScores = new Map();

    for (const track of trackRecommendations) {
      // Find which playlists this track appeared in
      for (const session of sessions) {
        if (!session.tracks) continue;

        const trackInSession = session.tracks.find(t => t.uri === track.uri);
        if (trackInSession) {
          const contextUri = trackInSession.contextUri || session.initialPlaylistUri;

          if (!playlistScores.has(contextUri)) {
            playlistScores.set(contextUri, {
              contextUri,
              playlistName: this.getPlaylistName(contextUri, sessions),
              playlistImage: this.getPlaylistImage(contextUri, sessions),
              trackCount: 0,
              totalScore: 0,
              topTracks: []
            });
          }

          const playlist = playlistScores.get(contextUri);
          playlist.trackCount++;
          playlist.totalScore += track.score;
          if (playlist.topTracks.length < 5) {
            playlist.topTracks.push(track);
          }
        }
      }
    }

    // Calculate average scores and convert to array
    const recommendations = Array.from(playlistScores.values()).map(playlist => ({
      playlistUri: playlist.contextUri,
      playlistName: playlist.playlistName,
      playlistImage: playlist.playlistImage,
      avgScore: playlist.totalScore / playlist.trackCount,
      timesUsed: playlist.trackCount,
      topTracks: playlist.topTracks
    }));

    // Sort by average score
    recommendations.sort((a, b) => b.avgScore - a.avgScore);

    return recommendations.slice(0, limit);
  }

  // Helper: Get playlist name from context URI
  getPlaylistName(contextUri, sessions) {
    for (const session of sessions) {
      if (session.initialPlaylistUri === contextUri) {
        return session.initialPlaylistName;
      }
      if (session.playlistsSwitched && session.playlistsSwitched.includes(contextUri)) {
        // Try to find name from tracks
        const track = session.tracks?.find(t => t.contextUri === contextUri);
        if (track) {
          return 'Mixed Playlist'; // Could enhance this
        }
      }
    }
    return 'Unknown Playlist';
  }

  // Helper: Get playlist image from context URI
  getPlaylistImage(contextUri, sessions) {
    for (const session of sessions) {
      if (session.initialPlaylistUri === contextUri && session.playlistImage) {
        return session.playlistImage;
      }
    }
    return null;
  }

  // Calculate duration score (0-1) based on listening time
  calculateDurationScore(session) {
    if (!session.duration) {
      return 0.5;
    }

    const hours = session.duration / 3600;

    if (hours >= 2) return 1.0;
    if (hours >= 1) return 0.8;
    if (hours >= 0.5) return 0.6;
    if (hours >= 0.25) return 0.4;

    return 0.2;
  }

  // Calculate rating score (0-1) based on user rating
  calculateRatingScore(session) {
    if (!session.rating) {
      return 0.5;
    }

    return (session.rating - 1) / 4;
  }

  // Extract keywords from text (for display purposes)
  extractKeywords(text, topN = 5) {
    const tokens = this.preprocessText(text);
    const frequency = {};

    for (const token of tokens) {
      frequency[token] = (frequency[token] || 0) + 1;
    }

    const sorted = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(entry => entry[0]);

    return sorted;
  }

  // Provide feedback on a recommendation
  async processFeedback(taskDescription, playlistUri, isPositive) {
    const sessions = await dataManager.getSessionsByPlaylist(playlistUri);

    console.log('Feedback received:', {
      task: taskDescription,
      playlist: playlistUri,
      positive: isPositive,
      existingSessions: sessions.length
    });

    return {
      success: true,
      message: isPositive ? 'Thanks for the feedback!' : 'Noted. We\'ll adjust recommendations.'
    };
  }

  // Get similar sessions for review
  async getSimilarSessions(taskDescription, sessions, limit = 3) {
    const queryTokens = this.preprocessText(taskDescription);

    if (queryTokens.length === 0 || sessions.length === 0) {
      return [];
    }

    const documents = sessions.map(session => ({
      session,
      tokens: this.preprocessText(session.taskDescription)
    }));

    const idf = this.calculateIDF(documents);
    const queryTFIDF = this.calculateTFIDF(queryTokens, idf);

    const similarities = documents.map(doc => {
      const docTFIDF = this.calculateTFIDF(doc.tokens, idf);
      const similarity = this.cosineSimilarity(queryTFIDF, docTFIDF);

      return {
        session: doc.session,
        similarity
      };
    });

    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, limit);
  }

  // Get audio feature insights from sessions
  getAudioFeatureInsights(sessions) {
    const allTracks = sessions.flatMap(s => s.tracks || []);
    const avgFeatures = this.getAverageAudioFeatures(allTracks);

    if (!avgFeatures) {
      return null;
    }

    return {
      averageEnergy: avgFeatures.energy,
      averageValence: avgFeatures.valence,
      averageDanceability: avgFeatures.danceability,
      mood: this.getMoodFromFeatures(avgFeatures),
      totalTracks: allTracks.length
    };
  }

  // Determine mood from audio features
  getMoodFromFeatures(features) {
    if (!features) return 'Unknown';

    const energy = features.energy;
    const valence = features.valence;

    if (energy > 0.7 && valence > 0.7) return 'Energetic & Happy';
    if (energy > 0.7 && valence < 0.3) return 'Energetic & Dark';
    if (energy < 0.3 && valence > 0.7) return 'Calm & Happy';
    if (energy < 0.3 && valence < 0.3) return 'Calm & Melancholic';
    if (valence > 0.6) return 'Positive';
    if (valence < 0.4) return 'Melancholic';
    if (energy > 0.6) return 'Energetic';
    if (energy < 0.4) return 'Calm';

    return 'Balanced';
  }
}

// Create global instance
const mlEngine = new MLEngine();
