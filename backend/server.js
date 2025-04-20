import express from "express";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import fs from "fs";
import csv from "csv-parser";
import path from "path";
import axios from "axios";
import cors from 'cors';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { fileURLToPath } from 'url';
import multer from 'multer';

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({
  origin: '*', // In production, limit this to your frontend's URL
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
    'my stats', 'my health stats', 'my health statistics', 'heart', 'rate',
    'past', 'data', 'readings', 'trends', 'average', 'averages', 'lifestyle',
    'conditions', 'exercise', 'diet', 'nutrition', 'wellness', 'well-being',
    'profile', 'health profile', 'about me', 'my profile', 'my information',
    'health', 'weight', 'height', 'smoking', 'alcohol', 'medical', 'conditions'
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
  
  // Add biomarker data if available
  if (additionalContext && additionalContext.healthData) {
    console.log('===DIAGNOSTIC: ADDING BIOMARKER DATA TO LLM CONTEXT===');
    console.log(JSON.stringify(additionalContext.healthData, null, 2));
    console.log('===END DIAGNOSTIC: BIOMARKER DATA===');
    
    inputText += `\n\n===USER BIOMARKER DATA===\n${JSON.stringify(additionalContext.healthData, null, 2)}\n===END USER BIOMARKER DATA===`;
  }
  
  // Add user health profile if available
  if (additionalContext && additionalContext.userHealthProfile) {
    console.log('===DIAGNOSTIC: ADDING USER HEALTH PROFILE TO LLM CONTEXT===');
    console.log(JSON.stringify(additionalContext.userHealthProfile, null, 2));
    console.log('===END DIAGNOSTIC: USER HEALTH PROFILE===');
    
    // Format the health profile in a more readable way
    let profileText = '';
    const profile = additionalContext.userHealthProfile;
    
    // Build a human-readable health profile summary
    if (profile) {
      profileText += `Age: ${profile.age || 'Not specified'}\n`;
      profileText += `Gender: ${profile.gender || 'Not specified'}\n`;
      profileText += `Height: ${profile.height ? `${profile.height} cm` : 'Not specified'}\n`;
      profileText += `Weight: ${profile.weight ? `${profile.weight} kg` : 'Not specified'}\n`;
      profileText += `Pre-existing Conditions: ${profile.preExistingConditions?.length > 0 ? profile.preExistingConditions.join(', ') : 'None reported'}\n`;
      profileText += `Alcohol Consumption: ${profile.alcohol || 'Not specified'}\n`;
      profileText += `Smoking: ${profile.smoking || 'Not specified'}\n`;
      profileText += `Recreational Drug Use: ${profile.drugUse ? 'Yes' : 'No'}\n`;
      profileText += `Exercise Level: ${profile.exerciseLevel || 'Not specified'}\n`;
      profileText += `Exercise Frequency: ${profile.exerciseFrequency ? `${profile.exerciseFrequency} times per week` : 'Not specified'}\n`;
      profileText += `Sleep: ${profile.sleepHours ? `${profile.sleepHours} hours per night` : 'Not specified'}\n`;
      profileText += `Stress Level: ${profile.stressLevel || 'Not specified'}\n`;
      profileText += `Diet Type: ${profile.dietType || 'Not specified'}\n`;
    }
    
    // Add the formatted profile to the LLM context
    inputText += `\n\n===USER HEALTH PROFILE===\n${profileText}\n===END USER HEALTH PROFILE===`;
  }
  
  // Log the complete input text being sent to the LLM
  console.log('===DIAGNOSTIC: COMPLETE LLM INPUT===');
  console.log(inputText);
  console.log('===END DIAGNOSTIC: COMPLETE LLM INPUT===');
  
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

// User Health Profile endpoints
app.post("/user-health-profile/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    const profileData = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "Missing userId parameter." });
    }
    
    if (!profileData) {
      return res.status(400).json({ error: "Missing profile data in request body." });
    }
    
    // Create userdata directory if it doesn't exist
    const USERDATA_DIR = path.join(__dirname, 'userdata');
    if (!fs.existsSync(USERDATA_DIR)) {
      fs.mkdirSync(USERDATA_DIR, { recursive: true });
    }
    
    // Write the profile data to a JSON file
    const filePath = path.join(USERDATA_DIR, `${userId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(profileData, null, 2));
    
    res.json({ 
      success: true, 
      message: "User health profile saved successfully"
    });
  } catch (error) {
    console.error("Error saving user health profile:", error);
    res.status(500).json({
      error: "Failed to save health profile.",
      details: error.message
    });
  }
});

app.get("/user-health-profile/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: "Missing userId parameter." });
    }
    
    const USERDATA_DIR = path.join(__dirname, 'userdata');
    const filePath = path.join(USERDATA_DIR, `${userId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return res.json({ profileExists: false });
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const profileData = JSON.parse(fileContent);
    
    res.json({ 
      profileExists: true,
      profileData
    });
  } catch (error) {
    console.error("Error retrieving user health profile:", error);
    res.status(500).json({
      error: "Failed to retrieve health profile.",
      details: error.message
    });
  }
});

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
    const { question, userId, userHealthProfile } = req.body;
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

    // Always include health profile if it exists, check for keywords for biomarker data
    const includeHealthData = containsHealthDataKeywords(question);
    let additionalContext = {};
    
    console.log(`===DIAGNOSTIC: CHAT CONTEXT DECISION===`);
    console.log(`Question: "${question}"`);
    console.log(`Contains health keywords: ${includeHealthData}`);
    console.log(`User health profile data:`, userHealthProfile);
    
    // Always include user health profile if available
    if (userHealthProfile) {
      console.log("Adding user health profile to context");
      additionalContext.userHealthProfile = userHealthProfile;
    }
    
    // Add biomarker data if keywords are found
    if (includeHealthData) {
      const healthData = getRecentHealthData();
      
      console.log(`Biomarker data available: ${healthData && !healthData.error && !healthData.noData ? 'Yes' : 'No'}`);
      
      if (healthData && !healthData.error && !healthData.noData) {
        additionalContext.healthData = healthData;
        console.log(`Context: Including biomarker data`);
      } else if (healthData.error) {
        console.error("Error getting health data:", healthData.error);
      }
    }
    
    // If no additional context was added, set to null for clarity
    if (Object.keys(additionalContext).length === 0) {
      additionalContext = null;
      console.log(`Context: No additional context available`);
    } else {
      console.log(`Context: Including additional context:`, Object.keys(additionalContext));
    }
    
    console.log(`===END DIAGNOSTIC: CHAT CONTEXT DECISION===`);
    
    // Invoke the Bedrock agent with additional context
    const result = await invokeBedrockAgent(question, sessionId, additionalContext);
    
    // If userId is provided, save the assistant response
    if (userId) {
      const assistantMessage = {
        role: 'assistant',
        content: result.completion
      };
      saveChatMessage(userId, sessionId, assistantMessage);
    }
    
    // For debugging, include in the response what data was included
    res.json({
      response: result.completion,
      sessionId: result.sessionId,
      healthDataIncluded: additionalContext?.healthData ? true : false,
      profileDataIncluded: additionalContext?.userHealthProfile ? true : false
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



// Health Readings Endpoints
app.post("/readings", (req, res) => {
  try {
    const { cortisol_base, lactate_base, uric_acid_base, crp_base, il6_base, body_temp_base, heart_rate_base, blood_oxygen_base } = req.body;
    
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
    
    res.json({ 
      success: true, 
      id: result.lastInsertRowid,
      message: "Health reading added successfully" 
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to store health reading" });
  }
});

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


// Start the server
app.listen(3000, () => {
  console.log("Server started successfully on port 3000");
});