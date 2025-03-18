// Import required dependencies
import express from 'express';
import cors from 'cors';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

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

// Test Route
app.get("/", (req, res) => {
  res.send("🚀 AWS Bedrock Agent Server is running!");
});

// Chat Route
app.post("/chat", async (req, res) => {
  try {
    const { question } = req.body;
    // Ensure we always have a valid sessionId
    const sessionId = req.body.sessionId || generateSessionId();

    if (!question) {
      return res.status(400).json({ error: "Missing question in request body." });
    }

    console.log(`Invoking agent ${AGENT_ID} (alias: ${AGENT_ALIAS_ID})`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`Question: ${question}`);
    
    const result = await invokeBedrockAgent(question, sessionId);
    
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