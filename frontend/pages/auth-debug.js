import React, { useState, useEffect } from 'react';

export default function AuthDebug() {
  const [sessionData, setSessionData] = useState(null);
  const [localStorageData, setLocalStorageData] = useState({});
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Check for session data in localStorage
    try {
      const storedSession = localStorage.getItem('user_session');
      if (storedSession) {
        const parsedSession = JSON.parse(storedSession);
        setSessionData(parsedSession);
      }
      
      // Get all localStorage data
      const storageItems = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
          const value = localStorage.getItem(key);
          try {
            // Try to parse JSON
            storageItems[key] = JSON.parse(value);
          } catch (e) {
            // Not JSON, store as string
            storageItems[key] = value;
          }
        } catch (e) {
          storageItems[key] = `Error reading value: ${e.message}`;
        }
      }
      setLocalStorageData(storageItems);
    } catch (e) {
      setError(`Error retrieving session data: ${e.message}`);
    }
  }, []);
  
  const formatToken = (token) => {
    if (!token) return null;
    
    // Show first and last few characters
    if (token.length > 30) {
      return token.substring(0, 15) + '...' + token.substring(token.length - 10);
    }
    return token;
  };
  
  const formatData = (data) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  };
  
  const createNewSession = () => {
    try {
      // Create mock session for testing
      const mockSession = {
        accessToken: 'mock_token_' + Date.now(),
        user: {
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin'
        },
        expiresAt: Date.now() + 3600000 // 1 hour
      };
      
      localStorage.setItem('user_session', JSON.stringify(mockSession));
      setSessionData(mockSession);
      
      // Update localStorage data
      const updatedData = {...localStorageData};
      updatedData['user_session'] = mockSession;
      setLocalStorageData(updatedData);
    } catch (e) {
      setError(`Error creating mock session: ${e.message}`);
    }
  };
  
  const clearSession = () => {
    try {
      localStorage.removeItem('user_session');
      setSessionData(null);
      
      // Update localStorage data
      const updatedData = {...localStorageData};
      delete updatedData['user_session'];
      setLocalStorageData(updatedData);
    } catch (e) {
      setError(`Error clearing session: ${e.message}`);
    }
  };
  
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Auth Debug Page</h1>
      
      {error && (
        <div style={{ backgroundColor: '#ffebee', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={createNewSession}
          style={{ padding: '8px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Create Mock Session
        </button>
        
        <button 
          onClick={clearSession}
          style={{ padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Clear Session
        </button>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Session Data</h2>
        {sessionData ? (
          <div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Token:</strong> {formatToken(sessionData.accessToken)}
            </div>
            
            {sessionData.user && (
              <div style={{ marginBottom: '10px' }}>
                <strong>User:</strong> {sessionData.user.email || 'Unknown'} 
                {sessionData.user.role && ` (${sessionData.user.role})`}
              </div>
            )}
            
            <div style={{ marginBottom: '10px' }}>
              <strong>Expires:</strong> {new Date(sessionData.expiresAt).toLocaleString() || 'Unknown'}
            </div>
            
            <div>
              <h3>Raw Session Data</h3>
              <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto', borderRadius: '4px' }}>
                {formatData(sessionData)}
              </pre>
            </div>
          </div>
        ) : (
          <p>No session data found. Click "Create Mock Session" to create test data.</p>
        )}
      </div>
      
      <div>
        <h2>All localStorage Data</h2>
        <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto', borderRadius: '4px' }}>
          {formatData(localStorageData)}
        </pre>
      </div>
    </div>
  );
} 