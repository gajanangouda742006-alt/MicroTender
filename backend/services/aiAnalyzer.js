const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("../config/database");
const fs = require("fs");
const path = require("path");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyDummyKeyForNow");

/**
 * Analyze complaint text and/or image using Gemini AI
 */
async function analyzeComplaint(text, imageUrl = null) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let prompt = `
      You are an expert AI Civic Infrastructure Analyst for a Smart City platform.
      Analyze the following civic complaint and provide a structured JSON response.

      Complaint Text: "${text}"

      The JSON response MUST include these fields:
      - category: One of [pothole, streetlight, water_leakage, garbage, road_damage, drainage, electrical, other]
      - severity: One of [low, medium, high, critical]
      - priority: One of [low, medium, high, critical]
      - estimatedCost: A number representing repair cost in INR (₹)
      - department: One of [Public Works, Electricity Board, Water Department, Sanitation, Municipal Authority]
      - vendorType: One of [Civil Contractor, Electrician, Plumber, Waste Management, Road Repair Team]
      - riskLevel: One of [low, medium, high]
      - aiSummary: A 1-sentence professional summary of the issue
      - resolutionEstimate: Estimated days to resolve (e.g., "3 days")
      - confidenceScore: A value between 0 and 1
      - sentimentScore: A value between -1 (negative) and 1 (positive)
      - authenticityPrediction: A confidence score (0-1) that this is a real complaint

      Return ONLY valid JSON.
    `;

    let result;
    if (imageUrl) {
      const fullPath = path.join(__dirname, '..', imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl);

      if (fs.existsSync(fullPath)) {
        const imageData = fs.readFileSync(fullPath);
        const imagePart = {
          inlineData: {
            data: imageData.toString("base64"),
            mimeType: "image/jpeg",
          },
        };
        result = await model.generateContent([prompt, imagePart]);
      } else {
        result = await model.generateContent(prompt);
      }
    } else {
      result = await model.generateContent(prompt);
    }

    const response = await result.response;
    const jsonText = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const analysis = JSON.parse(jsonText);

    return analysis;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return fallbackAnalysis(text);
  }
}

/**
 * Detect duplicate complaints nearby (async MySQL version)
 */
async function detectDuplicates(lat, lon, category, text) {
  try {
    const radius = 0.005; // Approx 500m
    const nearby = await db.all(`
      SELECT * FROM complaints 
      WHERE category = ? 
      AND latitude BETWEEN ? AND ? 
      AND longitude BETWEEN ? AND ?
      AND status != 'completed'
      ORDER BY created_at DESC LIMIT 5
    `, [category, lat - radius, lat + radius, lon - radius, lon + radius]);

    if (nearby.length === 0) return { isDuplicate: false, matches: [] };

    const matches = nearby.map(c => {
      const distance = calculateDistance(lat, lon, c.latitude, c.longitude);
      return {
        complaint_id: c.complaint_id,
        status: c.status,
        distance: `${(distance * 1000).toFixed(0)}m`,
        time: c.created_at
      };
    });

    return {
      isDuplicate: matches.length > 0,
      matches
    };
  } catch (error) {
    console.error("Duplicate Detection Error:", error);
    return { isDuplicate: false, matches: [] };
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function fallbackAnalysis(text) {
  const lowerText = text.toLowerCase();
  let category = 'other';
  let department = 'Municipal Authority';
  let cost = 5000;

  if (lowerText.includes('pothole') || lowerText.includes('road')) {
    category = 'pothole'; department = 'Public Works'; cost = 12000;
  } else if (lowerText.includes('light') || lowerText.includes('dark')) {
    category = 'streetlight'; department = 'Electricity Board'; cost = 3000;
  } else if (lowerText.includes('water') || lowerText.includes('leak')) {
    category = 'water_leakage'; department = 'Water Department'; cost = 7000;
  } else if (lowerText.includes('garbage') || lowerText.includes('waste')) {
    category = 'garbage'; department = 'Sanitation'; cost = 2000;
  }

  return {
    category,
    severity: lowerText.includes('accident') || lowerText.includes('danger') ? 'critical' : 'medium',
    priority: lowerText.includes('accident') ? 'high' : 'medium',
    estimatedCost: cost,
    department,
    vendorType: 'Civil Contractor',
    riskLevel: 'medium',
    aiSummary: "Automated analysis of the reported civic issue.",
    resolutionEstimate: "3-5 days",
    confidenceScore: 0.5,
    sentimentScore: 0,
    authenticityPrediction: 0.9
  };
}

/**
 * Smart Bid Ranking Formula
 * @param {number} bidAmount 
 * @param {number} estimatedCost 
 * @param {number} vendorRating 0-5
 * @param {number} jobsCompleted 
 * @param {number} estimatedDays 
 * @returns {number} Score out of 100
 */
function calculateBidScore(bidAmount, estimatedCost, vendorRating, jobsCompleted, estimatedDays) {
  // 1. Vendor Rating (30% weight)
  const ratingScore = ((vendorRating || 0) / 5) * 30;

  // 2. Cost Score (25% weight)
  const costDiffPercent = Math.abs(bidAmount - estimatedCost) / estimatedCost;
  // If diff is 0%, gets 25 pts. If diff is >= 50%, gets 0 pts.
  const costScore = Math.max(0, 25 - (costDiffPercent * 50));

  // 3. Speed Score (20% weight) - Assumes 1 day is best, subtracts 2 pts per additional day
  const speedScore = Math.max(0, 20 - ((estimatedDays || 7) - 1) * 2);

  // 4. Past Completion Rate (15% weight) - Approximation based on volume
  const completionScore = Math.min(15, (jobsCompleted || 0) * 1.5);

  // 5. Fraud Penalty (10% weight) - Simple static penalty for now, could be dynamic
  const fraudPenalty = 0;

  const totalScore = ratingScore + costScore + speedScore + completionScore - fraudPenalty;
  return parseFloat(Math.min(100, Math.max(0, totalScore)).toFixed(1));
}

/**
 * Verify completion by comparing original complaint image with vendor's completion image
 */
async function verifyCompletion(originalImageUrl, completionImageUrl, note) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let prompt = `
      You are an expert AI Civic Infrastructure Inspector.
      Compare the two images: the FIRST image is the original citizen complaint (the "Before"), and the SECOND image is the vendor's completion proof (the "After").
      Vendor's completion note: "${note || 'None provided'}"
      
      Determine if the issue appears resolved and check for signs of fraud (e.g., same image reused, edited, or issue still visible).

      Return ONLY a valid JSON with these fields:
      - isResolved: true or false
      - fraudDetected: true or false
      - reasoning: A 1-2 sentence explanation of your findings.
      - confidenceScore: A value between 0 and 1.
    `;

    const getPart = (url) => {
      if (!url) return null;
      const fullPath = path.join(__dirname, '..', url.startsWith('/') ? url.substring(1) : url);
      if (fs.existsSync(fullPath)) {
        return {
          inlineData: {
            data: fs.readFileSync(fullPath).toString("base64"),
            mimeType: "image/jpeg",
          },
        };
      }
      return null;
    };

    const originalPart = getPart(originalImageUrl);
    const completionPart = getPart(completionImageUrl);
    
    let parts = [prompt];
    if (originalPart) parts.push(originalPart);
    if (completionPart) parts.push(completionPart);

    const result = await model.generateContent(parts);
    const response = await result.response;
    const jsonText = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("AI Verification Error:", error);
    return {
      isResolved: true,
      fraudDetected: false,
      reasoning: "Automated verification failed; fallback to manual admin review.",
      confidenceScore: 0.5
    };
  }
}

/**
 * Analyze citizen review for sentiment and abuse
 */
async function analyzeReviewSentiment(feedback) {
  if (!feedback || feedback.trim() === '') return 'neutral';
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are an AI Moderation system.
      Analyze this citizen review feedback for a public infrastructure repair: "${feedback}"
      
      Classify it into EXACTLY ONE of these categories:
      - "positive": Praises the work or is generally happy.
      - "neutral": Just stating facts or is okay.
      - "negative": Criticizes the work, complains, but is not abusive.
      - "abusive": Uses offensive language, extreme toxicity, or threats.
      
      Return ONLY the category word. No other text.
    `;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim().toLowerCase();
    
    if (['positive', 'neutral', 'negative', 'abusive'].includes(text)) {
      return text;
    }
    return 'neutral';
  } catch (error) {
    console.error("Sentiment Analysis Error:", error);
    return 'neutral';
  }
}

module.exports = {
  analyzeComplaint,
  detectDuplicates,
  calculateBidScore,
  verifyCompletion,
  analyzeReviewSentiment
};
