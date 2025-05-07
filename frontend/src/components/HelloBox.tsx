import React from 'react';

const HelloBox: React.FC = () => {
  return (
    <div style={{
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '16px',
      maxWidth: '400px',
      margin: '20px auto',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
    }}>
      <h2 style={{ fontWeight: 'bold', fontSize: '24px' }}>Hello, User!</h2>
      <p>Here's a quick summary of your health:</p>
      <ul>
        <li>Overall Health: Good</li>
        <li>## Levels trending up</li>
        <li>Recommended Sleep: 7-8 hours</li>
      </ul>
    </div>
  );
};

export default HelloBox; 