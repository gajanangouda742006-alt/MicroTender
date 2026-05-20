const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyDummyKeyForNow");

router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, history } = req.body;
    
    // Fetch some quick platform context to pass to Gemini
    const stats = await db.get(`
      SELECT 
        (SELECT COUNT(*) FROM complaints) as totalComplaints,
        (SELECT COUNT(*) FROM complaints WHERE status = 'completed') as resolvedComplaints,
        (SELECT COUNT(*) FROM vendors) as totalVendors
    `);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Build context prompt
    const systemPrompt = `
      You are an expert AI Assistant for "MicroTender", a Smart City Civic Infrastructure platform.
      You help Citizens report issues, help Admins manage the platform, and help Vendors find jobs.
      
      Current Platform Stats:
      - Total Complaints: ${stats.totalComplaints}
      - Resolved Complaints: ${stats.resolvedComplaints}
      - Total Registered Vendors: ${stats.totalVendors}

      Keep your answers concise, helpful, and formatted in Markdown.
    `;

    // Convert history format if provided
    let chatHistory = [];
    if (history && Array.isArray(history)) {
      chatHistory = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
    }

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I am the MicroTender AI Assistant.' }] },
        ...chatHistory
      ]
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    res.json({ response: responseText });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ error: 'Failed to communicate with AI Assistant.' });
  }
});

module.exports = router;
