const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("../config/database");
const fs = require("fs");
const path = require("path");

// Initialize Gemini
// Note: In production, use environment variables for API keys
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
      // If image is provided, we use Vision capabilities
      // Note: imageUrl is relative to backend root, e.g., /uploads/xyz.jpg
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
    // Fallback to basic rule-based analysis if AI fails
    return fallbackAnalysis(text);
  }
}

/**
 * Detect duplicate complaints nearby
 */
async function detectDuplicates(lat, lon, category, text) {
  try {
    // Basic implementation: Find complaints within ~500m of the same category
    // In a real app, use Geolocation functions or Vector Search
    const radius = 0.005; // Approx 500m
    const nearby = db.prepare(`
      SELECT * FROM complaints 
      WHERE category = ? 
      AND latitude BETWEEN ? AND ? 
      AND longitude BETWEEN ? AND ?
      AND status != 'completed'
      ORDER BY created_at DESC LIMIT 5
    `).all(category, lat - radius, lat + radius, lon - radius, lon + radius);

    if (nearby.length === 0) return { isDuplicate: false, matches: [] };

    // Simple text similarity check (placeholder for embeddings)
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
  const R = 6371; // Earth radius in km
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
    category = 'pothole';
    department = 'Public Works';
    cost = 12000;
  } else if (lowerText.includes('light') || lowerText.includes('dark')) {
    category = 'streetlight';
    department = 'Electricity Board';
    cost = 3000;
  } else if (lowerText.includes('water') || lowerText.includes('leak')) {
    category = 'water_leakage';
    department = 'Water Department';
    cost = 7000;
  } else if (lowerText.includes('garbage') || lowerText.includes('waste')) {
    category = 'garbage';
    department = 'Sanitation';
    cost = 2000;
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

module.exports = {
  analyzeComplaint,
  detectDuplicates
};
