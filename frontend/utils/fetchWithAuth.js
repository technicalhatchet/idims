import { getSession } from '@auth0/nextjs-auth0/client';

/**
 * Fetch wrapper that adds authentication headers with improved error handling and retry
 */
export async function fetchWithAuth(url, options = {}, retries = 3) {
  // Get the user session
  let session;
  try {
    session = await getSession();
  } catch (error) {
    console.error('Error getting auth session:', error);
    throw new Error('Authentication error');
  }
  
  // Create default headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Add authorization header if user is authenticated
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`;
  }
  
  // Add CSRF token if available
  const csrfToken = typeof window !== 'undefined' ? 
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') : null;
  
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  // Add request ID for tracing
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    headers['X-Request-ID'] = crypto.randomUUID();
  }
  
  let lastError;
  
  // Try the request with retries for network errors
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      
      // Handle HTTP errors (not retried)
      if (!response.ok) {
        // Try to parse error response
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { detail: await response.text() || 'Unknown error' };
        }
        
        const error = new Error(errorData.detail || 'API request failed');
        error.status = response.status;
        error.statusText = response.statusText;
        error.data = errorData;
        throw error;
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      // Only retry on network errors, not HTTP errors
      if (error.status || attempt >= retries - 1) {
        break;
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * 2 ** attempt, 8000);
      console.log(`Retrying fetch request (attempt ${attempt + 1}/${retries}) in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Helper function to handle API responses
 */
export async function handleApiResponse(response) {
  try {
    if (response.status === 204) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Error parsing API response:', error);
    throw new Error('Invalid response format');
  }
}

// Higher-level fetch API that combines fetchWithAuth and handleApiResponse
export async function apiClient(endpoint, options = {}, retries = 3) {
  const response = await fetchWithAuth(endpoint, options, retries);
  return handleApiResponse(response);
}