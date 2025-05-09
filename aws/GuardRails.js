export const handler = async (event) => {
    try {
      const bannedWords = [
        'fortnite', 'minecraft', 'nba', 'bitcoin', 'amazon', 'youtube', 
        'movie', 'iphone', 'ps5', 'nintendo', 'tiktok', 'instagram'
      ];
  
      const medicalKeywords = [
        'diabetes', 'cancer', 'blood pressure', 'cholesterol', 'asthma', 
        'anxiety', 'depression', 'heart attack', 'stroke', 'infection', 'antibiotics'
      ];
  
      const query = (event.query || "").toLowerCase().trim();
  
      if (!query) {
        return {
          allowed: false,
          reason: "Empty query received."
        };
      }
  
      // Check for banned/off-topic content first
      const foundBannedWord = bannedWords.find(word => query.includes(word));
      if (foundBannedWord) {
        return {
          allowed: false,
          reason: `Off-topic content detected: '${foundBannedWord}'`
        };
      }
  
      const foundMedicalWord = medicalKeywords.find(word => query.includes(word));
      if (!foundMedicalWord) {
        return {
          allowed: false,
          reason: "Query is not recognized as medical-related."
        };
      }
  
      // If passed all checks
      return {
        allowed: true
      };
  
    } catch (error) {
      console.error("Lambda error:", error);
      return {
        allowed: false,
        reason: "Internal server error."
      };
    }
  };