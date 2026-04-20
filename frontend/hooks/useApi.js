import { useUser } from '@auth0/nextjs-auth0/client';
import { apiClient } from '../utils/api-client';

export function useApi() {
  const { user, error, isLoading } = useUser();
  
  // Create a wrapper function that checks for user before making API calls
  const api = user ? async (endpoint, options = {}) => {
    try {
      return await apiClient(endpoint, options);
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  } : null;
  
  return {
    apiClient: api,
    user,
    isLoading,
    error
  };
}