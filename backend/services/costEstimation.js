const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize Gemini
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;


// Cost configuration - easily adjustable
const COST_RULES = {
  pothole: {
    baseCost: 500,
    areaFactor: 150,       // per sq meter
    depthFactor: 200,      // per 10cm depth
    urgencyMultiplier: { low: 1.0, medium: 1.2, high: 1.5, critical: 2.0 },
    description: 'Pothole repair including filling, compacting, and surface finishing'
  },
  streetlight: {
    fixedCost: 2500,
    bulbReplaceCost: 800,
    wiringCost: 1500,
    poleCost: 8000,
    urgencyMultiplier: { low: 1.0, medium: 1.1, high: 1.3, critical: 1.5 },
    description: 'Streetlight repair or replacement'
  },
  water_leakage: {
    baseCost: 1000,
    lengthFactor: 300,     // per meter of pipe
    pipeDiameterFactor: 50, // per cm diameter
    urgencyMultiplier: { low: 1.0, medium: 1.3, high: 1.6, critical: 2.0 },
    description: 'Water leakage repair including excavation and pipe fixing'
  },
  garbage: {
    baseCost: 300,
    volumeFactor: 100,     // per cubic meter
    hazardousExtra: 500,
    urgencyMultiplier: { low: 1.0, medium: 1.1, high: 1.3, critical: 1.5 },
    description: 'Garbage collection and disposal'
  },
  road_damage: {
    baseCost: 2000,
    areaFactor: 500,       // per sq meter
    urgencyMultiplier: { low: 1.0, medium: 1.2, high: 1.5, critical: 2.0 },
    description: 'Road surface repair and resurfacing'
  },
  drainage: {
    baseCost: 1500,
    lengthFactor: 400,     // per meter
    urgencyMultiplier: { low: 1.0, medium: 1.2, high: 1.5, critical: 1.8 },
    description: 'Drainage system cleaning or repair'
  },
  electrical: {
    baseCost: 2000,
    complexityFactor: 500,
    urgencyMultiplier: { low: 1.0, medium: 1.2, high: 1.4, critical: 1.8 },
    description: 'Electrical infrastructure repair'
  },
  other: {
    baseCost: 1000,
    urgencyMultiplier: { low: 1.0, medium: 1.2, high: 1.5, critical: 2.0 },
    description: 'General civic maintenance work'
  }
};

/**
 * Estimate cost based on complaint category and parameters
 * @param {string} category - Complaint category
 * @param {object} params - Additional parameters (area, length, severity, etc.)
 * @returns {object} Cost estimation with breakdown
 */
function estimateCost(category, params = {}) {
  const normalizedCategory = category.toLowerCase().replace(/[\s-]+/g, '_');
  const rule = COST_RULES[normalizedCategory] || COST_RULES.other;
  const urgency = params.urgency || 'medium';
  const multiplier = rule.urgencyMultiplier[urgency] || 1.2;

  let baseCost = rule.baseCost || rule.fixedCost || 1000;
  let additionalCost = 0;
  const breakdown = [];

  breakdown.push({ item: 'Base cost', amount: baseCost });

  switch (normalizedCategory) {
    case 'pothole': {
      const area = params.area || 2;      // default 2 sq meters
      const depth = params.depth || 10;   // default 10 cm
      const areaCost = area * rule.areaFactor;
      const depthCost = (depth / 10) * rule.depthFactor;
      additionalCost = areaCost + depthCost;
      breakdown.push({ item: `Area repair (${area} sq m)`, amount: areaCost });
      breakdown.push({ item: `Depth factor (${depth} cm)`, amount: depthCost });
      break;
    }
    case 'streetlight': {
      const issueType = params.issueType || 'bulb';
      if (issueType === 'bulb') {
        additionalCost = rule.bulbReplaceCost;
        breakdown.push({ item: 'Bulb replacement', amount: rule.bulbReplaceCost });
      } else if (issueType === 'wiring') {
        additionalCost = rule.wiringCost;
        breakdown.push({ item: 'Wiring repair', amount: rule.wiringCost });
      } else if (issueType === 'pole') {
        additionalCost = rule.poleCost;
        breakdown.push({ item: 'Pole replacement', amount: rule.poleCost });
      }
      break;
    }
    case 'water_leakage': {
      const length = params.length || 3;        // default 3 meters
      const diameter = params.diameter || 5;     // default 5 cm
      const lengthCost = length * rule.lengthFactor;
      const diamCost = diameter * rule.pipeDiameterFactor;
      additionalCost = lengthCost + diamCost;
      breakdown.push({ item: `Pipe repair (${length} m)`, amount: lengthCost });
      breakdown.push({ item: `Pipe diameter (${diameter} cm)`, amount: diamCost });
      break;
    }
    case 'garbage': {
      const volume = params.volume || 5;
      const hazardous = params.hazardous || false;
      additionalCost = volume * rule.volumeFactor;
      breakdown.push({ item: `Volume (${volume} cu m)`, amount: volume * rule.volumeFactor });
      if (hazardous) {
        additionalCost += rule.hazardousExtra;
        breakdown.push({ item: 'Hazardous material surcharge', amount: rule.hazardousExtra });
      }
      break;
    }
    case 'road_damage': {
      const area = params.area || 5;
      additionalCost = area * rule.areaFactor;
      breakdown.push({ item: `Area repair (${area} sq m)`, amount: additionalCost });
      break;
    }
    case 'drainage': {
      const length = params.length || 5;
      additionalCost = length * rule.lengthFactor;
      breakdown.push({ item: `Drainage length (${length} m)`, amount: additionalCost });
      break;
    }
    case 'electrical': {
      const complexity = params.complexity || 1;
      additionalCost = complexity * rule.complexityFactor;
      breakdown.push({ item: `Complexity factor (${complexity})`, amount: additionalCost });
      break;
    }
    default:
      break;
  }

  const subtotal = baseCost + additionalCost;
  const urgencyExtra = subtotal * (multiplier - 1);
  const totalCost = Math.round(subtotal * multiplier);

  if (urgencyExtra > 0) {
    breakdown.push({ item: `Urgency surcharge (${urgency})`, amount: Math.round(urgencyExtra) });
  }

  return {
    category: normalizedCategory,
    estimatedCost: totalCost,
    breakdown,
    description: rule.description,
    urgency,
    confidence: normalizedCategory === 'other' ? 0.6 : 0.85,
    method: 'rule_based_v1'
  };
}

/**
 * Determine priority based on category and description keywords
 */
function determinePriority(category, description = '') {
  const desc = description.toLowerCase();

  // Critical keywords
  const criticalKeywords = ['emergency', 'dangerous', 'accident', 'collapse', 'flood', 'electric shock', 'fire'];
  const highKeywords = ['urgent', 'severe', 'major', 'blocked', 'overflow', 'broken'];
  const lowKeywords = ['minor', 'small', 'cosmetic', 'slight'];

  if (criticalKeywords.some(k => desc.includes(k))) return 'critical';
  if (highKeywords.some(k => desc.includes(k))) return 'high';
  if (lowKeywords.some(k => desc.includes(k))) return 'low';

  // Category-based defaults
  const highPriorityCategories = ['water_leakage', 'electrical', 'drainage'];
  const mediumPriorityCategories = ['pothole', 'streetlight', 'road_damage'];

  const normalized = category.toLowerCase().replace(/[\s-]+/g, '_');
  if (highPriorityCategories.includes(normalized)) return 'high';
  if (mediumPriorityCategories.includes(normalized)) return 'medium';
  return 'medium';
}


/**
 * AI-powered cost estimation using Gemini
 * @param {string} category 
 * @param {string} description 
 * @returns {Promise<object>}
 */
async function estimateCostAI(category, description) {
  if (!genAI) {
    console.log('⚠️ Gemini API key missing, falling back to rule-based estimation.');
    return estimateCost(category, { description });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
      You are an expert civic infrastructure cost estimator. 
      Analyze the following complaint and provide a structured JSON cost estimation.
      
      Category: ${category}
      Description: ${description}
      
      Rules for estimation:
      - Base cost for ${category} is around ${COST_RULES[category.toLowerCase()]?.baseCost || 1000}.
      - Return a JSON object with:
        {
          "estimatedCost": number,
          "breakdown": [{"item": string, "amount": number}],
          "priority": "low" | "medium" | "high" | "critical",
          "ai_analysis": string (short reasoning),
          "confidence": number (0 to 1)
        }
      Only return valid JSON.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response (in case of markdown blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiData = JSON.parse(jsonMatch[0]);
      return {
        ...aiData,
        category,
        method: 'gemini_ai_v1',
        description: COST_RULES[category.toLowerCase()]?.description || 'AI analyzed work'
      };
    }
    throw new Error('Invalid AI response format');
  } catch (error) {
    console.error('AI Estimation Error:', error.message);
    return estimateCost(category, { description });
  }
}

module.exports = { estimateCost, estimateCostAI, determinePriority, COST_RULES };
