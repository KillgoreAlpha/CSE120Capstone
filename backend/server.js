import express from "express";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import fs from "fs";
import csv from "csv-parser";
import path from "path";
import axios from "axios";
import cors from 'cors';
import http from "http";
import { WebSocketServer } from "ws";
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { fileURLToPath } from 'url';
import multer from 'multer';

dotenv.config();
const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(cors({
  origin: '*', // In production, limit this to your frontend's URL
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Set up WebSocket server for real-time data streaming
const wss = new WebSocketServer({ server });
const connectedClients = new Set();

// Set up directory for chat storage (local atm, need to migrate to s3)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHATS_DIR = path.join(__dirname, 'chats');

// Create chats directory if it doesn't exist
if (!fs.existsSync(CHATS_DIR)) {
  fs.mkdirSync(CHATS_DIR, { recursive: true });
}

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// AWS Bedrock Agent configuration - use env vars or fallback to hardcoded values
const AGENT_ID = process.env.AGENT_ID || "AJBHXXILZN";
const AGENT_ALIAS_ID = process.env.AGENT_ALIAS_ID || "AVKP1ITZAA";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

// Initialize SQLite database
const db = new Database('userHealth.db');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS healthReadings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cortisol_base REAL,
    lactate_base REAL,
    uric_acid_base REAL,
    crp_base REAL,
    il6_base REAL,
    body_temp_base REAL,
    heart_rate_base REAL,
    blood_oxygen_base REAL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS healthConditions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    alcohol INTEGER DEFAULT 0,
    drugs INTEGER DEFAULT 0,
    no_excercise INTEGER DEFAULT 0,
    light_exercise INTEGER DEFAULT 0,
    heavy_exercise INTEGER DEFAULT 0,
    diabetes INTEGER DEFAULT 0,
    hyperthyroidism INTEGER DEFAULT 0,
    depression INTEGER DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// Consolidated prepared statements for reuse
const statements = {
  readings: {
    insert: db.prepare(
      'INSERT INTO healthReadings (cortisol_base, lactate_base, uric_acid_base, crp_base, il6_base, body_temp_base, heart_rate_base, blood_oxygen_base) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ),
    getAll: db.prepare('SELECT * FROM healthReadings'),
    getById: db.prepare('SELECT * FROM healthReadings WHERE id = ?'),
    delete: db.prepare('DELETE FROM healthReadings WHERE id = ?'),
    update: db.prepare(`
      UPDATE healthReadings 
      SET cortisol_base = ?, lactate_base = ?, uric_acid_base = ?, crp_base = ?, il6_base = ?, body_temp_base = ?, heart_rate_base = ?, blood_oxygen_base = ? 
      WHERE id = ?
    `),
    getByTimeframe: db.prepare(`
      SELECT * FROM healthReadings
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `),
    getBiomarkerByTimeframe: db.prepare(`
      SELECT id, :biomarker, timestamp 
      FROM healthReadings
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `)
  },
  conditions: {
    insert: db.prepare(
      'INSERT INTO healthConditions (user_id, alcohol, drugs, no_excercise, light_exercise, heavy_exercise, diabetes, hyperthyroidism, depression) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ),
    getAll: db.prepare('SELECT * FROM healthConditions'),
    getById: db.prepare('SELECT * FROM healthConditions WHERE id = ?'),
    delete: db.prepare('DELETE FROM healthConditions WHERE id = ?'),
    update: db.prepare(`
      UPDATE healthConditions 
      SET user_id = ?, alcohol = ?, drugs = ?, no_excercise = ?, light_exercise = ?, heavy_exercise = ?, diabetes = ?, hyperthyroidism = ?, depression = ? 
      WHERE id = ?
    `),
    count: db.prepare('SELECT COUNT(*) as count FROM healthConditions')
  }
};

// Function to query biomarker data within a timeframe
function getBiomarkerDataInTimeframe(biomarker, startTime, endTime) {
  try {
    // Validate that the biomarker exists in our table
    const validBiomarkers = [
      'cortisol_base', 'lactate_base', 'uric_acid_base', 'crp_base', 
      'il6_base', 'body_temp_base', 'heart_rate_base', 'blood_oxygen_base'
    ];
    
    if (!validBiomarkers.includes(biomarker)) {
      throw new Error(`Invalid biomarker: ${biomarker}. Valid options are: ${validBiomarkers.join(', ')}`);
    }
    
    // Create a custom query with the biomarker name as a named parameter
    const customQuery = db.prepare(`
      SELECT id, ${biomarker}, timestamp 
      FROM healthReadings
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `);
    
    const results = customQuery.all(startTime, endTime);
    return results;
  } catch (error) {
    console.error("Error in getBiomarkerDataInTimeframe:", error);
    throw error;
  }
}

// CSV Processing Functions
function processCSVStream(csvFilePath, onHeader, onData, onComplete, onError) {
  let rowsProcessed = 0;
  let rowsImported = 0;
  
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('headers', headers => {
      if (onHeader) onHeader(headers);
    })
    .on('data', row => {
      rowsProcessed++;
      try {
        if (onData(row)) rowsImported++;
      } catch (error) {
        console.error(`Error processing row ${rowsProcessed}: ${error}`);
      }
    })
    .on('end', () => {
      if (onComplete) onComplete(rowsProcessed, rowsImported);
    })
    .on('error', error => {
      if (onError) onError(error);
      else console.error(`Error reading CSV: ${error}`);
    });
}

function importBiomarkerDataFromCSV() {
  const csvFilePath = path.join(process.cwd(), 'biomarker_data.csv');
  
  // Check if the file exists
  if (!fs.existsSync(csvFilePath)) {
    console.error(`File not found: ${csvFilePath}`);
    return false;
  }
  
  return new Promise((resolve, reject) => {
    let rowsProcessed = 0;
    let rowsImported = 0;
    
    processCSVStream(
      csvFilePath,
      null, // No header processing needed
      (row) => {
        // Map CSV columns with unit suffixes to database column names
        const values = [
          row.cortisol_ug_dL !== undefined ? parseFloat(row.cortisol_ug_dL) : null,
          row.lactate_mmol_L !== undefined ? parseFloat(row.lactate_mmol_L) : null,
          row.uric_acid_mg_dL !== undefined ? parseFloat(row.uric_acid_mg_dL) : null,
          row.crp_mg_L !== undefined ? parseFloat(row.crp_mg_L) : null,
          row.il6_pg_mL !== undefined ? parseFloat(row.il6_pg_mL) : null,
          row.body_temp_C !== undefined ? parseFloat(row.body_temp_C) : null,
          row.heart_rate_BPM !== undefined ? parseFloat(row.heart_rate_BPM) : null,
          row.blood_oxygen_pct !== undefined ? parseFloat(row.blood_oxygen_pct) : null
        ];
        
        // Insert the data into the database
        statements.readings.insert.run(...values);
        return true; // Count as imported
      },
      (processed, imported) => {
        resolve({ processed, imported });
      },
      (error) => {
        console.error(`Error reading CSV: ${error}`);
        reject(error);
      }
    );
  });
}

// Function to seed health conditions data
function seedHealthConditionsData() {
  // First, check if we have any existing data
  const existingCount = statements.conditions.count.get();
  
  // Only seed if the table is empty
  if (existingCount.count === 0) {
    
    // Let's create seed data for a few different users
    const sampleUsers = [
      {
        user_id: 12345,  // This is our placeholder user ID
        alcohol: 0,
        drugs: 0,
        no_excercise: 1,
        light_exercise: 0,
        heavy_exercise: 0,
        diabetes: 0,
        hyperthyroidism: 0,
        depression: 1
      },
      {
        user_id: 54321,
        alcohol: 1,
        drugs: 0,
        no_excercise: 0,
        light_exercise: 1,
        heavy_exercise: 0,
        diabetes: 1,
        hyperthyroidism: 0,
        depression: 0
      },
      {
        user_id: 98765,
        alcohol: 0,
        drugs: 0,
        no_excercise: 0,
        light_exercise: 0,
        heavy_exercise: 1,
        diabetes: 0,
        hyperthyroidism: 1,
        depression: 0
      }
    ];
    
    // Insert each sample user
    let insertedCount = 0;
    for (const user of sampleUsers) {
      try {
        statements.conditions.insert.run(
          user.user_id,
          user.alcohol,
          user.drugs,
          user.no_excercise,
          user.light_exercise,
          user.heavy_exercise,
          user.diabetes,
          user.hyperthyroidism,
          user.depression
        );
        insertedCount++;
      } catch (error) {
        console.error(`Error inserting seed health condition: ${error}`);
      }
    }
    
    return insertedCount;
  } else {
    return 0;
  }
}

/**
 * Checks if the user prompt contains keywords related to health data.
 * @param {string} prompt - The user's prompt/question text
 * @returns {boolean} - True if the prompt contains health data keywords
 */
const containsHealthDataKeywords = (prompt) => {
  if (!prompt) return false;
  
  // Convert to lowercase for case-insensitive matching
  const lowerPrompt = prompt.toLowerCase();
  
  // Define keywords related to health data
  const healthKeywords = [
    'my data', 'my health', 'my biomarkers', 'biomarkers', 
    'health data', 'my health data', 'my readings', 'my metrics',
    'cortisol', 'lactate', 'uric acid', 'crp', 'il6', 'il-6',
    'body temperature', 'heart rate', 'blood oxygen', 'my levels',
    'my stats', 'my health stats', 'my health statistics'
  ];
  
  // Check if any keyword is present in the prompt
  return healthKeywords.some(keyword => lowerPrompt.includes(keyword));
};

/**
 * Retrieves recent health data for the user.
 * @returns {object} - Object containing the user's health data
 */
const getRecentHealthData = () => {
  try {
    // Get the last 20 readings from the database
    const recentReadings = db.prepare(`
      SELECT * FROM healthReadings 
      ORDER BY timestamp DESC 
      LIMIT 20
    `).all();
    
    if (!recentReadings || recentReadings.length === 0) {
      return { noData: true };
    }
    
    // Calculate averages for each biomarker
    const biomarkers = [
      'cortisol_base', 'lactate_base', 'uric_acid_base', 'crp_base', 
      'il6_base', 'body_temp_base', 'heart_rate_base', 'blood_oxygen_base'
    ];
    
    const averages = {};
    const trends = {};
    
    biomarkers.forEach(biomarker => {
      const values = recentReadings
        .map(reading => reading[biomarker])
        .filter(val => val !== null && val !== undefined);
      
      if (values.length > 0) {
        // Calculate average
        const sum = values.reduce((acc, val) => acc + val, 0);
        averages[biomarker] = sum / values.length;
        
        // Determine trend based on first half vs second half
        if (values.length >= 4) {
          const midpoint = Math.floor(values.length / 2);
          const firstHalf = values.slice(midpoint); // More recent values (reversed order)
          const secondHalf = values.slice(0, midpoint); // Older values
          
          const firstHalfAvg = firstHalf.reduce((acc, val) => acc + val, 0) / firstHalf.length;
          const secondHalfAvg = secondHalf.reduce((acc, val) => acc + val, 0) / secondHalf.length;
          
          const percentChange = ((firstHalfAvg - secondHalfAvg) / secondHalfAvg) * 100;
          
          if (percentChange > 5) {
            trends[biomarker] = "increasing";
          } else if (percentChange < -5) {
            trends[biomarker] = "decreasing";
          } else {
            trends[biomarker] = "stable";
          }
        } else {
          trends[biomarker] = "insufficient data";
        }
      }
    });
    
    return {
      readings: recentReadings.slice(0, 5), // Just the 5 most recent readings
      averages,
      trends,
      readingCount: recentReadings.length,
      startDate: recentReadings[recentReadings.length - 1].timestamp,
      endDate: recentReadings[0].timestamp
    };
  } catch (error) {
    console.error("Error getting recent health data:", error);
    return { error: error.message };
  }
};

/**
 * Invokes a Bedrock agent to run an inference using the input
 * provided in the request body.
 *
 * @param {string} prompt - The prompt that you want the Agent to complete.
 * @param {string} sessionId - An arbitrary identifier for the session.
 * @param {object} [additionalContext] - Optional additional context/data to include
 */
const invokeBedrockAgent = async (prompt, sessionId, additionalContext = null) => {
  // Create client with region from env vars or credentials if provided
  let clientConfig = { region: AWS_REGION };
  
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }
  
  const client = new BedrockAgentRuntimeClient(clientConfig);
  
  // Generate a session ID if none is provided
  const finalSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  
  // Prepare the input text - include health data if provided
  let inputText = prompt;
  
  if (additionalContext && additionalContext.healthData) {
    inputText += `\n\n===USER HEALTH DATA===\n${JSON.stringify(additionalContext.healthData, null, 2)}\n===END USER HEALTH DATA===`;
  }
  
  const command = new InvokeAgentCommand({
    agentId: AGENT_ID,
    agentAliasId: AGENT_ALIAS_ID,
    sessionId: finalSessionId,
    inputText: inputText,
  });
  
  try {
    let completion = "";
    const response = await client.send(command);
    
    if (response.completion === undefined) {
      throw new Error("Completion is undefined");
    }
    
    for await (const chunkEvent of response.completion) {
      const chunk = chunkEvent.chunk;
      const decodedResponse = new TextDecoder("utf-8").decode(chunk.bytes);
      completion += decodedResponse;
    }
    
    return { sessionId: finalSessionId, completion };
  } catch (err) {
    console.error("Error in invokeBedrockAgent:", err);
    throw err;
  }
};

// Helper function to generate a session ID if none provided
function generateSessionId() {
  return 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
}

// Helper functions for chat history
function getChatFilePath(userId, sessionId) {
  return path.join(CHATS_DIR, `${userId}-${sessionId}.json`);
}

function saveChatMessage(userId, sessionId, message) {
  const filePath = getChatFilePath(userId, sessionId);
  let chatHistory = [];
  
  // Read existing chat history if available
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      chatHistory = JSON.parse(fileContent);
    } catch (error) {
      console.error(`Error reading chat history: ${error.message}`);
    }
  }
  
  // Add timestamp to message
  const messageWithTimestamp = {
    ...message,
    timestamp: new Date().toISOString()
  };
  
  // Add the new message
  chatHistory.push(messageWithTimestamp);
  
  // Save the updated chat history
  try {
    fs.writeFileSync(filePath, JSON.stringify(chatHistory, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving chat history: ${error.message}`);
    return false;
  }
}

function getChatHistory(userId, sessionId) {
  const filePath = getChatFilePath(userId, sessionId);
  
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent);
    } catch (error) {
      console.error(`Error reading chat history: ${error.message}`);
      return [];
    }
  }
  
  return [];
}

function getUserChatSessions(userId) {
  const userChats = [];
  
  try {
    const files = fs.readdirSync(CHATS_DIR);
    
    for (const file of files) {
      if (file.startsWith(`${userId}-`) && file.endsWith('.json')) {
        const sessionId = file.substring(userId.length + 1, file.length - 5);
        const filePath = path.join(CHATS_DIR, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const messages = JSON.parse(fileContent);
        
        if (messages.length > 0) {
          // Get the first user message as title, or use a default
          const firstUserMsg = messages.find(msg => msg.role === 'user');
          const title = firstUserMsg 
            ? (firstUserMsg.content.length > 30 
                ? firstUserMsg.content.substring(0, 30) + '...' 
                : firstUserMsg.content)
            : 'Untitled Chat';
          
          // Get the latest timestamp
          const latestMessage = messages[messages.length - 1];
          const timestamp = latestMessage.timestamp;
          
          userChats.push({
            sessionId,
            title,
            timestamp,
            messageCount: messages.length
          });
        }
      }
    }
    
    // Sort chats by timestamp, most recent first
    userChats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return userChats;
  } catch (error) {
    console.error(`Error getting user chat sessions: ${error.message}`);
    return [];
  }
}

// ENDPOINT ROUTES

// Chat sessions and history routes
app.get("/chat-sessions/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: "Missing userId parameter." });
    }
    
    const chatSessions = getUserChatSessions(userId);
    res.json({ chatSessions });
  } catch (error) {
    console.error("Error getting chat sessions:", error);
    res.status(500).json({
      error: "Failed to get chat sessions.",
      details: error.message
    });
  }
});

app.get("/chat-history/:userId/:sessionId", (req, res) => {
  try {
    const { userId, sessionId } = req.params;
    
    if (!userId || !sessionId) {
      return res.status(400).json({ error: "Missing userId or sessionId parameter." });
    }
    
    const chatHistory = getChatHistory(userId, sessionId);
    res.json({ messages: chatHistory, sessionId });
  } catch (error) {
    console.error("Error getting chat history:", error);
    res.status(500).json({
      error: "Failed to get chat history.",
      details: error.message
    });
  }
});

// Updated chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const { question, userId } = req.body;
    // Ensure we always have a valid sessionId
    const sessionId = req.body.sessionId || generateSessionId();

    if (!question) {
      return res.status(400).json({ error: "Missing question in request body." });
    }

    // If userId is provided, save the user message
    if (userId) {
      const userMessage = {
        role: 'user',
        content: question
      };
      saveChatMessage(userId, sessionId, userMessage);
    }

    // Check if the question contains health data keywords
    const includeHealthData = containsHealthDataKeywords(question);
    let additionalContext = null;
    
    if (includeHealthData) {
      const healthData = getRecentHealthData();
      
      if (healthData && !healthData.error && !healthData.noData) {
        additionalContext = { healthData };
      } else if (healthData.error) {
        console.error("Error getting health data:", healthData.error);
      }
    }
    
    // Invoke the Bedrock agent with or without health data
    const result = await invokeBedrockAgent(question, sessionId, additionalContext);
    
    // If userId is provided, save the assistant response
    if (userId) {
      const assistantMessage = {
        role: 'assistant',
        content: result.completion
      };
      saveChatMessage(userId, sessionId, assistantMessage);
    }
    
    // For debugging, you can include in the response whether health data was included
    res.json({
      response: result.completion,
      sessionId: result.sessionId,
      healthDataIncluded: !!additionalContext
    });
  } catch (error) {
    console.error("AWS Bedrock Agent Error:", error);
    res.status(500).json({ 
      error: "Failed to get response from AWS Bedrock Agent.",
      details: error.message
    });
  }
});

// Endpoint to query biomarker data within a timeframe
app.get("/biomarker/:name", (req, res) => {
  try {
    const { name } = req.params;
    const { startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({ error: "Missing startTime or endTime parameters" });
    }
    
    const data = getBiomarkerDataInTimeframe(name, startTime, endTime);
    
    res.json({
      biomarker: name,
      startTime,
      endTime,
      data
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve biomarker data" });
  }
});



// Health Readings Endpoints - GET endpoints
// (POST endpoint is defined separately to ensure WebSocket broadcasting works properly)

app.get("/readings", (req, res) => {
  try {
    const readings = statements.readings.getAll.all();
    res.json({ readings });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to retrieve health readings" });
  }
});

app.get("/readings/:id", (req, res) => {
  try {
    const id = req.params.id;
    const reading = statements.readings.getById.get(id);
    
    if (!reading) {
      return res.status(404).json({ error: "Reading not found" });
    }
    
    res.json({ reading });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to retrieve health reading" });
  }
});

app.put("/readings/:id", (req, res) => {
  try {
    const id = req.params.id;
    const { cortisol_base, lactate_base, uric_acid_base, crp_base, il6_base, body_temp_base, heart_rate_base, blood_oxygen_base } = req.body;
    
    // Check if reading exists
    const reading = statements.readings.getById.get(id);
    if (!reading) {
      return res.status(404).json({ error: "Reading not found" });
    }
    
    statements.readings.update.run(
      cortisol_base !== undefined ? cortisol_base : reading.cortisol_base,
      lactate_base !== undefined ? lactate_base : reading.lactate_base,
      uric_acid_base !== undefined ? uric_acid_base : reading.uric_acid_base,
      crp_base !== undefined ? crp_base : reading.crp_base,
      il6_base !== undefined ? il6_base : reading.il6_base,
      body_temp_base !== undefined ? body_temp_base : reading.body_temp_base,
      heart_rate_base !== undefined ? heart_rate_base : reading.heart_rate_base,
      blood_oxygen_base !== undefined ? blood_oxygen_base : reading.blood_oxygen_base,
      id
    );
    
    res.json({ 
      success: true, 
      message: "Health reading updated successfully" 
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to update health reading" });
  }
});

app.delete("/readings/:id", (req, res) => {
  try {
    const id = req.params.id;
    
    // Check if reading exists
    const reading = statements.readings.getById.get(id);
    if (!reading) {
      return res.status(404).json({ error: "Reading not found" });
    }
    
    statements.readings.delete.run(id);
    
    res.json({ 
      success: true, 
      message: "Health reading deleted successfully" 
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to delete health reading" });
  }
});

app.post("/conditions", (req, res) => {
  try {
    const { user_id, alcohol, drugs, no_excercise, light_exercise, heavy_exercise, diabetes, hyperthyroidism, depression } = req.body;
    
    // Validate that all required fields exist
    if ([alcohol, drugs, no_excercise, light_exercise, heavy_exercise, diabetes, hyperthyroidism, depression].some(value => value === undefined)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Run insert query with user_id (default to 12345 if not provided)
    const result = statements.conditions.insert.run(
      user_id || 12345,  // Use our placeholder ID if none provided
      alcohol ? 1 : 0, 
      drugs ? 1 : 0, 
      no_excercise ? 1 : 0,
      light_exercise ? 1 : 0, 
      heavy_exercise ? 1 : 0, 
      diabetes ? 1 : 0, 
      hyperthyroidism ? 1 : 0, 
      depression ? 1 : 0
    );

    // Respond with success message
    res.status(201).json({ message: "Condition added successfully", id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: "Database error", details: error.message });
  }
});

app.get("/conditions", (req, res) => {
  try {
    const conditions = statements.conditions.getAll.all();
    res.json({ conditions });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to retrieve health conditions" });
  }
});

app.get("/conditions/:id", (req, res) => {
  try {
    const id = req.params.id;
    const condition = statements.conditions.getById.get(id);
    
    if (!condition) {
      return res.status(404).json({ error: "Condition not found" });
    }
    
    res.json({ condition });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to retrieve health condition" });
  }
});

app.put("/conditions/:id", (req, res) => {
  try {
    const id = req.params.id;
    const { user_id, alcohol, drugs, no_excercise, light_exercise, heavy_exercise, diabetes, hyperthyroidism, depression } = req.body;
    
    // Check if condition exists
    const condition = statements.conditions.getById.get(id);
    if (!condition) {
      return res.status(404).json({ error: "Condition not found" });
    }
    
    statements.conditions.update.run(
      user_id !== undefined ? user_id : condition.user_id,
      alcohol !== undefined ? (alcohol ? 1 : 0) : condition.alcohol,
      drugs !== undefined ? (drugs ? 1 : 0) : condition.drugs,
      no_excercise !== undefined ? (no_excercise ? 1 : 0) : condition.no_excercise,
      light_exercise !== undefined ? (light_exercise ? 1 : 0) : condition.light_exercise,
      heavy_exercise !== undefined ? (heavy_exercise ? 1 : 0) : condition.heavy_exercise,
      diabetes !== undefined ? (diabetes ? 1 : 0) : condition.diabetes,
      hyperthyroidism !== undefined ? (hyperthyroidism ? 1 : 0) : condition.hyperthyroidism,
      depression !== undefined ? (depression ? 1 : 0) : condition.depression,
      id
    );
    
    res.json({ 
      success: true, 
      message: "Health condition updated successfully" 
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to update health condition" });
  }
});

app.delete("/conditions/:id", (req, res) => {
  try {
    const id = req.params.id;
    
    // Check if condition exists
    const condition = statements.conditions.getById.get(id);
    if (!condition) {
      return res.status(404).json({ error: "Condition not found" });
    }
    
    statements.conditions.delete.run(id);
    
    res.json({ 
      success: true, 
      message: "Health condition deleted successfully" 
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to delete health condition" });
  }
});

// Close the database when the app is terminated
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

// Add this endpoint after your other endpoints
app.post("/import-biomarker-data", async (req, res) => {
  try {
    const result = await importBiomarkerDataFromCSV();
    if (result === false) {
      return res.status(404).json({ error: "Biomarker data CSV file not found" });
    }
    
    res.json({
      success: true,
      message: `Successfully processed ${result.processed} rows and imported ${result.imported} rows`,
      rowsProcessed: result.processed,
      rowsImported: result.imported
    });
  } catch (error) {
    console.error("Error importing biomarker data:", error);
    res.status(500).json({ error: "Failed to import biomarker data" });
  }
});

// Import biomarker data and seed conditions on startup
(async () => {
  try {
    // First import biomarker data
    await importBiomarkerDataFromCSV();
    
    // Then seed health conditions
    seedHealthConditionsData();
  } catch (error) {
    console.error("Error during startup data operations:", error);
  }
})();

// Close the database when the app is terminated
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});


// WebSocket server event handlers
wss.on('connection', (ws, req) => {
  console.log('New WebSocket client connected');
  
  // Add unique ID to help with debugging
  ws.id = Date.now() + '-' + Math.random().toString(36).substring(2, 10);
  
  // Add client to the set
  connectedClients.add(ws);
  
  // Enhanced error handling for the initial connection
  ws.isAlive = true;
  
  // Give the connection a moment to stabilize before sending data
  setTimeout(async () => {
    // Verify the connection is still open
    if (ws.readyState !== 1) {
      console.log(`Connection ${ws.id} closed before initialization completed`);
      connectedClients.delete(ws);
      return;
    }
    
    // Send a ping to verify connection is working
    try {
      ws.send(JSON.stringify({ 
        type: 'ping', 
        message: 'Connection established',
        clientId: ws.id,
        timestamp: new Date().toISOString()
      }));
      console.log('Sent welcome ping to new WebSocket client');
    } catch (error) {
      console.error('Error sending welcome ping:', error);
      ws.isAlive = false;
      connectedClients.delete(ws);
      ws.terminate();
      return;
    }
    
    // Send initial data to the new client after a short delay
    try {
      await sendLatestBiomarkerData(ws);
    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  }, 200); // Short delay to ensure connection is established
  
  // Set up ping interval to keep connection alive
  const pingInterval = setInterval(() => {
    if (!ws.isAlive) {
      console.log(`Client ${ws.id} failed to respond to ping, terminating connection`);
      clearInterval(pingInterval);
      connectedClients.delete(ws);
      return ws.terminate();
    }
    
    if (ws.readyState === 1) { // WebSocket.OPEN
      try {
        // Set isAlive to false, will be set to true when pong is received
        ws.isAlive = false;
        ws.send(JSON.stringify({ 
          type: 'ping', 
          timestamp: new Date().toISOString(),
          clientId: ws.id
        }));
      } catch (error) {
        console.error(`Error sending ping to client ${ws.id}:`, error);
        clearInterval(pingInterval);
        connectedClients.delete(ws);
        ws.terminate();
      }
    } else {
      clearInterval(pingInterval);
      connectedClients.delete(ws);
    }
  }, 15000); // Send ping every 15 seconds
  
  ws.on('message', (message) => {
    console.log(`Received message from client ${ws.id}:`, message.toString());
    
    // Parse message to check for pong responses
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'pong') {
        ws.isAlive = true; // Mark the connection as alive when pong is received
      }
    } catch (error) {
      console.error(`Error parsing client ${ws.id} message:`, error);
    }
    
    // Echo back to confirm receipt
    if (ws.readyState === 1) {
      try {
        ws.send(JSON.stringify({ 
          type: 'echo', 
          received: message.toString(),
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error(`Error sending echo response to client ${ws.id}:`, error);
      }
    }
  });
  
  ws.on('close', () => {
    console.log(`WebSocket client ${ws.id} disconnected`);
    connectedClients.delete(ws);
    clearInterval(pingInterval);
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${ws.id}:`, error);
    connectedClients.delete(ws);
    clearInterval(pingInterval);
    try {
      ws.terminate();
    } catch (e) {
      // Ignore errors during termination
    }
  });
});

// Function to broadcast biomarker data to all connected clients
function broadcastBiomarkerData(data) {
  // Make sure we're using the correct biomarker field names expected by the frontend
  const formattedData = {
    timestamp: data.timestamp || new Date().toISOString(),
    cortisol_base: data.cortisol_base,
    lactate_base: data.lactate_base,
    uric_acid_base: data.uric_acid_base,
    crp_base: data.crp_base,
    il6_base: data.il6_base,
    body_temp_base: data.body_temp_base,
    heart_rate_base: data.heart_rate_base,
    blood_oxygen_base: data.blood_oxygen_base
  };
  
  const message = JSON.stringify(formattedData);
  
  // Only attempt broadcast if we have active clients
  if (connectedClients.size === 0) {
    console.log('No WebSocket clients connected for broadcast');
    return;
  }
  
  console.log(`Broadcasting data to ${connectedClients.size} WebSocket clients`);
  
  let sentCount = 0;
  let disconnectedClients = [];
  
  for (const client of connectedClients) {
    // Check if the client socket is really open
    if (client.readyState === 1) { // WebSocket.OPEN = 1
      try {
        client.send(message);
        sentCount++;
      } catch (error) {
        console.error(`Error sending to WebSocket client ${client.id || 'unknown'}:`, error);
        // Mark this client for cleanup
        disconnectedClients.push(client);
      }
    } else {
      // Any state other than OPEN means we should remove this client
      disconnectedClients.push(client);
      console.log(`Found stale client connection in state ${client.readyState}, marking for cleanup`);
    }
  }
  
  // Cleanup any disconnected clients
  if (disconnectedClients.length > 0) {
    for (const client of disconnectedClients) {
      connectedClients.delete(client);
      try {
        client.terminate();
      } catch (e) {
        // Ignore errors during termination
      }
    }
    console.log(`Cleaned up ${disconnectedClients.length} disconnected WebSocket clients`);
  }
  
  console.log(`Successfully sent data to ${sentCount} clients`);
}

// Function to send latest biomarker data to a specific client
async function sendLatestBiomarkerData(ws) {
  try {
    // Check if the WebSocket is still open
    if (ws.readyState !== 1) { // WebSocket.OPEN = 1
      console.warn('Cannot send initial data - WebSocket not open');
      return;
    }
    
    // Get the most recent readings from the database (last 10 to ensure we have data)
    const latestReadings = db.prepare(`
      SELECT * FROM healthReadings 
      ORDER BY timestamp DESC
      LIMIT 10
    `).all();
    
    if (latestReadings && latestReadings.length > 0) {
      // Process each reading with a short delay between them to avoid overwhelming the client
      // First send the oldest reading to ensure proper time-order display
      const reversedReadings = latestReadings.reverse();
      
      for (let i = 0; i < reversedReadings.length; i++) {
        const reading = reversedReadings[i];
        
        // Format data the same way as the broadcast function
        const formattedData = {
          timestamp: reading.timestamp || new Date().toISOString(),
          cortisol_base: reading.cortisol_base,
          lactate_base: reading.lactate_base,
          uric_acid_base: reading.uric_acid_base,
          crp_base: reading.crp_base,
          il6_base: reading.il6_base,
          body_temp_base: reading.body_temp_base,
          heart_rate_base: reading.heart_rate_base,
          blood_oxygen_base: reading.blood_oxygen_base
        };
        
        // Check if the WebSocket is still open before sending
        if (ws.readyState === 1) { // WebSocket.OPEN = 1
          try {
            ws.send(JSON.stringify(formattedData));
          } catch (error) {
            console.error('Error in WebSocket send operation:', error);
            break;
          }
          
          // Add a small delay between messages if not the last message
          // This helps the client process them properly
          if (i < reversedReadings.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } else {
          break; // Stop if the connection is closed
        }
      }
      
      console.log(`Successfully sent initial data (${reversedReadings.length} readings) to new client`);
    } else {
      console.warn('No biomarker readings found to send to new client');
    }
  } catch (error) {
    console.error('Error sending latest biomarker data:', error);
  }
}

// Endpoint to trigger a data broadcast to all connected clients
app.post('/broadcast-biomarker', (req, res) => {
  try {
    const data = req.body;
    broadcastBiomarkerData(data);
    res.json({ success: true, clientCount: connectedClients.size });
  } catch (error) {
    console.error('Error broadcasting data:', error);
    res.status(500).json({ error: 'Failed to broadcast data' });
  }
});

// Handle /readings POST requests directly with our own endpoint
// This ensures WebSocket broadcasting works properly
app.post('/readings', (req, res) => {
  try {
    // Extract data from request body
    const { 
      cortisol_base, 
      lactate_base, 
      uric_acid_base, 
      crp_base, 
      il6_base, 
      body_temp_base, 
      heart_rate_base, 
      blood_oxygen_base 
    } = req.body;
    
    console.log('Received new biomarker reading:', req.body);
    
    // Insert data into database
    const result = statements.readings.insert.run(
      cortisol_base || null, 
      lactate_base || null, 
      uric_acid_base || null, 
      crp_base || null, 
      il6_base || null,
      body_temp_base || null,
      heart_rate_base || null,
      blood_oxygen_base || null
    );
    
    // Broadcast data to all connected WebSocket clients
    broadcastBiomarkerData(req.body);
    
    // Return success response
    res.json({ 
      success: true, 
      id: result.lastInsertRowid,
      message: "Health reading added successfully" 
    });
  } catch (error) {
    console.error("Error processing biomarker reading:", error);
    res.status(500).json({ error: "Failed to store health reading" });
  }
});

// Start the server
server.listen(3000, () => {
  console.log("Server started successfully on port 3000");
  console.log("WebSocket server enabled for real-time data streaming");
});