import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import AWS SDK for Cognito Identity Provider
import { CognitoIdentityProviderClient, AdminListGroupsForUserCommand } from "@aws-sdk/client-cognito-identity-provider";

// Initialize the CognitoIdentityProviderClient 
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-2', // Use your AWS region
});

// Cognito User Pool ID
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || ''; // Add your User Pool ID

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  // Extract userId from params or query parameter
  const userId = req.params.userId || req.query.userId;
  
  // Special test case for development
  if (process.env.NODE_ENV === 'development' && req.query.testAdmin === 'true') {
    return next();
  }
  
  // If no userId provided, deny access
  if (!userId) {
    return res.status(403).json({ error: 'User ID required', isAdmin: false });
  }
  
  try {
    // Check if user is in administrators group
    const isAdminUser = await checkUserInAdminGroup(userId);
    
    if (!isAdminUser) {
      return res.status(403).json({ error: 'Unauthorized access', isAdmin: false });
    }
    
    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    return res.status(500).json({ error: 'Error checking admin status', isAdmin: false });
  }
};

// Helper function to check if a user is in the administrators group
async function checkUserInAdminGroup(username) {
  // Skip check if no User Pool ID is provided (development fallback)
  if (!USER_POOL_ID) {
    console.warn('No Cognito User Pool ID provided, skipping admin check');
    return process.env.NODE_ENV === 'development';
  }
  
  try {
    const command = new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });
    
    const response = await cognitoClient.send(command);
    
    // Check if the user belongs to the administrators group
    return response.Groups.some(group => group.GroupName === 'administrators');
  } catch (error) {
    console.error('Error checking Cognito groups:', error);
    // In development, allow access for testing
    return process.env.NODE_ENV === 'development';
  }
}

// Check if user is an admin
router.get('/check-admin/:userId', async (req, res) => {
  const userId = req.params.userId;
  
  // Special test case for development
  if (process.env.NODE_ENV === 'development' && req.query.testAdmin === 'true') {
    return res.json({ isAdmin: true });
  }
  
  try {
    const isAdminUser = await checkUserInAdminGroup(userId);
    res.json({ isAdmin: isAdminUser });
  } catch (error) {
    console.error('Error checking admin status:', error);
    // For security, default to not admin on errors
    res.json({ isAdmin: false });
  }
});

// Get list of research papers - admin only
router.get('/papers', isAdmin, (req, res) => {
  try {
    const papersPath = path.join(__dirname, '../biomarker_research/paper_registry.json');
    
    if (!fs.existsSync(papersPath)) {
      return res.status(404).json({ error: 'Paper registry not found' });
    }
    
    const paperData = fs.readFileSync(papersPath, 'utf8');
    const papers = JSON.parse(paperData);
    
    res.json(papers);
  } catch (error) {
    console.error('Error fetching paper registry:', error);
    res.status(500).json({ error: 'Failed to fetch research papers' });
  }
});

// Get consolidated research text - admin only
router.get('/consolidated', isAdmin, (req, res) => {
  try {
    const textPath = path.join(__dirname, '../biomarker_research/consolidated_papers.txt');
    
    if (!fs.existsSync(textPath)) {
      return res.status(404).json({ error: 'Consolidated papers text not found' });
    }
    
    const text = fs.readFileSync(textPath, 'utf8');
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(text);
  } catch (error) {
    console.error('Error fetching consolidated text:', error);
    res.status(500).json({ error: 'Failed to fetch consolidated research text' });
  }
});

export default router;