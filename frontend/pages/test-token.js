// pages/test-token.js
import React from 'react';

export default function TestToken() {
  return (
    <div>
      <h1>Token Test</h1>
      <p>This is a simple test page.</p>
      <button onClick={() => fetch('/api/auth/token-debug').then(res => res.json()).then(console.log).catch(console.error)}>
        Test Token API
      </button>
    </div>
  );
}