import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser } from '@auth0/nextjs-auth0';
// Remove this import
// import apiClient from '../utils/api-client';

export const ApiContext = createContext();

export function ApiProvider({ children }) {
  const { user, isLoading } = useUser();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isTokenAvailable, setIsTokenAvailable] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      if (!user) {
        setIsAuthenticated(false);
        setIsTokenAvailable(false);
        return;
      }
      
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const session = await response.json();
          setIsAuthenticated(true);
          setIsTokenAvailable(!!session.accessToken);
        } else {
          setIsAuthenticated(false);
          setIsTokenAvailable(false);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
        setIsTokenAvailable(false);
      }
    };
    
    checkAuth();
  }, [user]);
  
  // Import apiClient dynamically when needed
  const getApiClient = () => {
    // This ensures apiClient is only imported when this function is called
    return require('../utils/api-client').default;
  };
  
  const value = {
    apiClient: getApiClient(),
    user,
    isAuthenticated,
    isLoading,
    isTokenAvailable
  };
  
  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApiContext() {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApiContext must be used within an ApiProvider');
  }
  return context;
}