// Import required dependencies
import express from 'express';
import cors from 'cors';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure path to .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3001'], 
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// AWS Bedrock Agent configuration
const AGENT_ID = process.env.AGENT_ID;
const AGENT_ALIAS_ID = process.env.AGENT_ALIAS_ID;
const AWS_REGION = process.env.AWS_REGION || "us-east-1";



// Helper function to generate a session ID
function generateSessionId() {
  return 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
}

/**
 * Invokes a Bedrock agent to run an inference using the input
 * provided in the request body.
 *
 * @param {string} prompt - The prompt that you want the Agent to complete.
 * @param {string} sessionId - An arbitrary identifier for the session.
 */
const invokeBedrockAgent = async (prompt, sessionId) => {
  // Ensure sessionId is never null - use a generated ID if not provided
  const safeSessionId = sessionId || generateSessionId();
  
  // Create client with explicit credentials
  const clientConfig = { 
    region: AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  };
  
  // Add session token if it exists (for temporary credentials)
  if (process.env.AWS_SESSION_TOKEN) {
    clientConfig.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
  }
  
  const client = new BedrockAgentRuntimeClient(clientConfig);
  
  const command = new InvokeAgentCommand({
    agentId: process.env.AGENT_ID,
    agentAliasId: process.env.AGENT_ALIAS_ID,
    sessionId: safeSessionId,  // Use the safe session ID
    inputText: prompt,
  });
  
  try {
    console.log(`Using session ID: ${safeSessionId}`);
    
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
    
    return { sessionId: safeSessionId, completion };
  } catch (err) {
    console.error("Error in invokeBedrockAgent:", err);
    throw err;
  }
};

// Test Route
app.get("/", (req, res) => {
  res.send("🚀 AWS Bedrock Agent Server is running!");
});

// Chat Route
app.post("/chat", async (req, res) => {
  try {
    const { question, sessionId } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Missing question in request body." });
    }

    // Generate a session ID if one is not provided
    const chatSessionId = sessionId || generateSessionId();
    
    console.log(`Invoking agent ${AGENT_ID} (alias: ${AGENT_ALIAS_ID})`);
    console.log(`Session ID: ${chatSessionId}`);
    console.log(`Question: ${question}`);
    
    const result = await invokeBedrockAgent(question, chatSessionId);
    
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