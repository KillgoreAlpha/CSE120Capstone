// This is a wrapper script that adds global error handlers before starting the server

// Manually disable nodemon's file watching for certain paths
// This is an extra safeguard in addition to .nodemonignore
process.env.NODEMON_IGNORE = [
  'chats',
  'chats/**/*',
  'userdata',
  'userdata/**/*',
  'uploads',
  'uploads/**/*',
  '*.db',
  '*.json'
].join(',');

// Add global exception handlers
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION - keeping process alive:', err);
  // Log the error but don't exit - keep the server running despite the error
});

// Handle unhandled promise rejections at the top level
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
  // Log the error but don't exit - keep the server running despite the error
});

// Prevent WebSocket errors from crashing the server
process.on('error', (err) => {
  console.error('PROCESS ERROR EVENT - keeping process alive:', err);
  // Just log, don't crash
});

// Override console.error to avoid any crashes from error logging
const originalConsoleError = console.error;
console.error = function(...args) {
  try {
    originalConsoleError.apply(console, args);
  } catch (err) {
    // If console.error itself throws (very rare), just continue
    process.stderr.write('Error in console.error itself: ' + err.message + '\n');
  }
};

// Import and run the main server
import './server.js';

console.log('Server started with enhanced error handling and crash prevention');
console.log('Ignoring file changes in: chats/, userdata/, uploads/, *.db, *.json');