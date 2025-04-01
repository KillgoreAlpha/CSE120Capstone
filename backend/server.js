// Import required dependencies
import express from 'express';
import cors from 'cors';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Set up directory for chat storage (local atm, need to migrate to s3)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHATS_DIR = path.join(__dirname, 'chats');

// Create chats directory if it doesn't exist
if (!fs.existsSync(CHATS_DIR)) {
  fs.mkdirSync(CHATS_DIR, { recursive: true });
}

// Middleware
app.use(cors({
  origin: '*', // In production, limit this to your frontend's URL
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// AWS Bedrock Agent configuration - use env vars or fallback to hardcoded values
const AGENT_ID = process.env.AGENT_ID || "AJBHXXILZN";
const AGENT_ALIAS_ID = process.env.AGENT_ALIAS_ID || "AVKP1ITZAA";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

/**
 * Invokes a Bedrock agent to run an inference using the input
 * provided in the request body.
 *
 * @param {string} prompt - The prompt that you want the Agent to complete.
 * @param {string} sessionId - An arbitrary identifier for the session.
 */
const invokeBedrockAgent = async (prompt, sessionId) => {
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
  
  const command = new InvokeAgentCommand({
    agentId: AGENT_ID,
    agentAliasId: AGENT_ALIAS_ID,
    sessionId: finalSessionId,
    inputText: prompt,
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

// Test Route
app.get("/", (req, res) => {
  res.send("🚀 AWS Bedrock Agent Server is running!");
});

// Get user chat sessions
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

// Get chat history for a specific session
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

// Chat Route
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

    console.log(`Invoking agent ${AGENT_ID} (alias: ${AGENT_ALIAS_ID})`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`User ID: ${userId || 'anonymous'}`);
    console.log(`Question: ${question}`);
    
    const result = await invokeBedrockAgent(question, sessionId);
    
    // If userId is provided, save the assistant response
    if (userId) {
      const assistantMessage = {
        role: 'assistant',
        content: result.completion
      };
      saveChatMessage(userId, sessionId, assistantMessage);
    }
    
    res.json({
      response: result.completion,
      sessionId: result.sessionId
    });
  } catch (error) {
    console.error("AWS Bedrock Agent Error:", error);
    res.status(500).json({ 
      error: "Failed to get response from AWS Bedrock Agent.",
      details: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});