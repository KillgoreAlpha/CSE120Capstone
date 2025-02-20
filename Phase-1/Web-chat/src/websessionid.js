//must install this libarary on terminal - npm install uuid
import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const App = () => {
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    // Check if a session ID already exists
    let currentSessionId = localStorage.getItem('sessionId');
    if (!currentSessionId) {
      // Generate a new session ID and save it to localStorage
      currentSessionId = uuidv4();
      sessionStorage.setItem('sessionId', currentSessionId);
    }
    sessionId(currentSessionId); // Update state with session ID
  }, []);

  return (
    <div>
      <h1>Your Session ID</h1>
      <p>{sessionId}</p>
    </div>
  );
};

export default App;
