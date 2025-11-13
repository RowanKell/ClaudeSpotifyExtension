// ML Engine for Smart Playlist Recommendations
// Implements TF-IDF + Cosine Similarity algorithm

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

    // Lowercase and remove punctuation
    const cleaned = text.toLowerCase().replace(/[^\w\s]/g, ' ');

    // Tokenize
    const tokens = cleaned.split(/\s+/).filter(token => token.length > 0);

    // Remove stop words
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

    // Normalize by document length
    for (const token in tf) {
      tf[token] = tf[token] / totalTokens;
    }

    return tf;
  }

  // Calculate inverse document frequency
  calculateIDF(documents) {
    const idf = {};
    const totalDocs = documents.length;

    // Count documents containing each term
    const docFrequency = {};
    for (const doc of documents) {
      const uniqueTokens = new Set(doc.tokens);
      for (const token of uniqueTokens) {
        docFrequency[token] = (docFrequency[token] || 0) + 1;
      }
    }

    // Calculate IDF
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

  // Calculate cosine similarity between two TF-IDF vectors
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

  // Get recommendations based on task description
  async getRecommendations(taskDescription, sessions, limit = 5) {
    if (!sessions || sessions.length === 0) {
      return [];
    }

    // Preprocess query
    const queryTokens = this.preprocessText(taskDescription);
    if (queryTokens.length === 0) {
      return [];
    }

    // Preprocess all session tasks and build IDF
    const documents = sessions.map(session => ({
      session,
      tokens: this.preprocessText(session.taskDescription)
    })).filter(doc => doc.tokens.length > 0);

    if (documents.length === 0) {
      return [];
    }

    // Calculate IDF across all documents
    const idf = this.calculateIDF(documents);

    // Calculate TF-IDF for query
    const queryTFIDF = this.calculateTFIDF(queryTokens, idf);

    // Calculate similarities
    const similarities = documents.map(doc => {
      const docTFIDF = this.calculateTFIDF(doc.tokens, idf);
      const similarity = this.cosineSimilarity(queryTFIDF, docTFIDF);

      // Calculate composite score with weights
      const durationScore = this.calculateDurationScore(doc.session);
      const ratingScore = this.calculateRatingScore(doc.session);

      // Weighted scoring: 70% similarity, 20% duration, 10% rating
      const finalScore = (similarity * 0.7) + (durationScore * 0.2) + (ratingScore * 0.1);

      return {
        session: doc.session,
        similarity,
        finalScore
      };
    });

    // Sort by final score
    similarities.sort((a, b) => b.finalScore - a.finalScore);

    // Group by playlist and aggregate scores
    const playlistScores = {};
    for (const item of similarities) {
      const uri = item.session.playlistUri;

      if (!playlistScores[uri]) {
        playlistScores[uri] = {
          playlistUri: uri,
          playlistName: item.session.playlistName,
          playlistImage: item.session.playlistImage,
          sessions: [],
          totalScore: 0,
          avgScore: 0,
          timesUsed: 0
        };
      }

      playlistScores[uri].sessions.push(item);
      playlistScores[uri].totalScore += item.finalScore;
      playlistScores[uri].timesUsed += 1;
    }

    // Calculate average scores
    const recommendations = Object.values(playlistScores).map(playlist => {
      playlist.avgScore = playlist.totalScore / playlist.timesUsed;
      return playlist;
    });

    // Sort by average score and limit results
    recommendations.sort((a, b) => b.avgScore - a.avgScore);

    return recommendations.slice(0, limit);
  }

  // Calculate duration score (0-1) based on listening time
  calculateDurationScore(session) {
    if (!session.duration) {
      return 0.5; // Neutral score if no duration data
    }

    // Sessions longer than 1 hour get higher scores
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
      return 0.5; // Neutral score if no rating
    }

    // Convert 1-5 star rating to 0-1 scale
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
    // Get existing sessions for this playlist
    const sessions = await dataManager.getSessionsByPlaylist(playlistUri);

    // For now, we'll just log the feedback
    // In a more advanced system, we could adjust weights or create synthetic sessions
    console.log('Feedback received:', {
      task: taskDescription,
      playlist: playlistUri,
      positive: isPositive,
      existingSessions: sessions.length
    });

    // Could implement: boost/reduce scores for similar tasks in the future
    return {
      success: true,
      message: isPositive ? 'Thanks for the feedback!' : 'Noted. We\'ll adjust recommendations.'
    };
  }

  // Suggest similar sessions for review
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
}

// Create global instance
const mlEngine = new MLEngine();
