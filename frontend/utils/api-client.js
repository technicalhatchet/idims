// Enhanced API client with improved token handling and debugging
import { getSession } from './auth';

// Error types for better error handling
export const ErrorTypes = {
  NETWORK: "NETWORK_ERROR",
  AUTH: "AUTHENTICATION_ERROR",
  SERVER: "SERVER_ERROR",
  CLIENT: "CLIENT_ERROR",
  UNKNOWN: "UNKNOWN_ERROR",
  CORS: "CORS_ERROR",
}

// Check if we're in a browser environment
const isBrowser = typeof window !== "undefined"

// Token cache to avoid multiple requests
let tokenCache = {
  token: null,
  expiresAt: null,
}

/** Single in-flight token fetch so parallel API calls share one /api/auth/token request */
let inFlightTokenPromise = null

const TOKEN_FETCH_TIMEOUT_MS = 20000

/** Backend request timeout (abort) — prevents infinite spinners when the API is down or unreachable */
const DEFAULT_API_TIMEOUT_MS = 90000

function createFetchTimeoutSignal(ms) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms)
  }
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

// Simple function to get session from localStorage instead of next-auth
const getSessionData = async () => {
  try {
    // Check localStorage for session data
    const sessionStr = localStorage.getItem("user_session")
    if (!sessionStr) return null

    const session = JSON.parse(sessionStr)
    if (!session || !session.accessToken) return null

    return session
  } catch (error) {
    console.error("Error getting session:", error)
    return null
  }
}

// API base URL - should always include trailing slash
// Make sure this value is consistent with what's used in the compiled app
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/"

/**
 * Helper function to construct a complete API URL
 * @param {string} endpoint - The endpoint to call, with or without leading slash
 * @param {boolean} tryBothPrefixes - Whether to try both prefixed and non-prefixed URLs (for future use)
 * @returns {string} The complete URL
 */
export function buildApiUrl(endpoint, tryBothPrefixes = false) {
  const debug = process.env.NODE_ENV !== "production"

  // Handle the case where no endpoint is provided
  if (!endpoint) return API_BASE_URL

  // Remove leading slash if present in the endpoint
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.substring(1) : endpoint

  // Remove trailing slash from base URL if it exists
  const baseWithoutTrailingSlash = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL

  // Check if base URL already contains /api
  const baseContainsApiPath = baseWithoutTrailingSlash.toLowerCase().endsWith("/api")
  
  // CRITICAL FIX: Never add api/ prefix if the base URL already has /api
  // or if the endpoint itself starts with api/
  if (baseContainsApiPath) {
    // If the base URL has /api, we need to remove any api/ prefix from the endpoint
    const finalEndpoint = cleanEndpoint.startsWith("api/") 
      ? cleanEndpoint.substring(4) // Remove 'api/' from the beginning
      : cleanEndpoint
      
    if (debug) console.log(`[buildApiUrl] ${baseWithoutTrailingSlash}/${finalEndpoint}`)
    return `${baseWithoutTrailingSlash}/${finalEndpoint}`
  }
  // For all other cases, ensure the endpoint has the api/ prefix
  const finalEndpoint = cleanEndpoint.startsWith("api/") 
    ? cleanEndpoint 
    : `api/${cleanEndpoint}`
    
  if (debug) console.log(`[buildApiUrl] ${baseWithoutTrailingSlash}/${finalEndpoint}`)
  return `${baseWithoutTrailingSlash}/${finalEndpoint}`
}

/**
 * Fetch a new access token from the Next.js API (single flight; result is cached).
 */
async function fetchAccessTokenFromServer() {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), TOKEN_FETCH_TIMEOUT_MS)
  try {
    const response = await fetch("/api/auth/token", {
      credentials: "same-origin",
      cache: "no-cache",
      signal: ac.signal,
    })

    if (!response.ok) {
      console.error("Failed to retrieve token:", response.status, response.statusText)
      try {
        const errorText = await response.text()
        console.error("Token endpoint error:", errorText)
      } catch (e) {
        // Ignore error reading response
      }
      return null
    }

    const data = await response.json()
    const token = data.accessToken

    if (!token) {
      console.error("No access token found in response. Response data:", data)
      return null
    }

    if (typeof token !== "string" || token.length < 20) {
      console.error("Invalid token format received:", token.substring(0, 10) + "...")
      return null
    }

    const now = Date.now()
    const expiresIn = data.expiresIn || 600
    tokenCache = {
      token,
      expiresAt: now + expiresIn * 1000,
    }

    console.log("Successfully retrieved access token. Expires in", expiresIn, "seconds")
    return token
  } catch (error) {
    if (error?.name === "AbortError") {
      console.error("Token request timed out after", TOKEN_FETCH_TIMEOUT_MS / 1000, "s — check /api/auth/token and Auth0 session")
    } else {
      console.error("Error getting access token:", error)
    }
    return null
  } finally {
    clearTimeout(t)
  }
}

/**
 * Get access token with caching and in-flight deduplication
 * @param {boolean} forceRefresh - Force a token refresh
 * @returns {Promise<string|null>} The access token or null
 */
const getAccessToken = async (forceRefresh = false) => {
  const now = Date.now()
  if (!forceRefresh && tokenCache.token && tokenCache.expiresAt && now < tokenCache.expiresAt) {
    return tokenCache.token
  }

  if (!forceRefresh && inFlightTokenPromise) {
    return inFlightTokenPromise
  }

  console.log("Retrieving fresh access token...")
  const p = fetchAccessTokenFromServer()
  inFlightTokenPromise = p.finally(() => {
    inFlightTokenPromise = null
  })
  return inFlightTokenPromise
}

/**
 * Get authorization headers for API requests
 * @returns {Promise<Object>} Headers object with authorization
 */
export async function getAuthHeaders() {
  try {
    const token = await getAccessToken()
    if (!token) {
      return {}
    }
    return {
      Authorization: `Bearer ${token}`,
    }
  } catch (error) {
    console.error("Error getting auth headers:", error)
    return {}
  }
}

/**
 * Classify error types for better handling
 */
const classifyError = (error, response = null) => {
  // Classify errors for better handling
  if (error.message && error.message.includes("Failed to fetch")) {
    // Check if this is likely a CORS error
    if (
      error.message.includes("CORS") ||
      (response && response.type === "opaque") ||
      error.message.includes("NetworkError")
    ) {
      return ErrorTypes.CORS
    }
    return ErrorTypes.NETWORK
  }

  if (response) {
    if (response.status === 401 || response.status === 403) {
      return ErrorTypes.AUTH
    }
    if (response.status >= 500) {
      return ErrorTypes.SERVER
    }
    if (response.status >= 400) {
      return ErrorTypes.CLIENT
    }
  }

  return ErrorTypes.UNKNOWN
}

/**
 * Handle API response with proper error handling
 */
const handleResponse = async (response) => {
  const contentType = response.headers.get("content-type")
  const isJson = contentType && contentType.includes("application/json")

  if (!response.ok) {
    let errorData
    try {
      if (isJson) {
        errorData = await response.json()
      } else {
        errorData = await response.text()
      }
    } catch (e) {
      console.error("Error parsing error response:", e)
      errorData = "Unknown error occurred"
    }

    const error = new Error()
    error.status = response.status
    error.type = classifyError(error, response)

    if (typeof errorData === "object" && errorData !== null) {
      error.message = errorData.message || errorData.detail || "An error occurred"
      error.details = errorData.errors || errorData.error
    } else {
      error.message = errorData
    }

    console.error(`API Error (${response.status}):`, error)
    throw error
  }

  if (isJson) {
    try {
      return await response.json()
    } catch (e) {
      console.error("Error parsing JSON response:", e)
      throw new Error("Invalid JSON response from server")
    }
  }

  return response.text()
}

/**
 * Main API client function for making requests to the backend
 * @param {string} endpoint - API endpoint to call
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} Response data
 */
export async function apiClient(endpoint, options = {}) {
  const {
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
    signal: callerSignal,
    auth: authOption,
    ...fetchableOptions
  } = options

  const debug = process.env.NODE_ENV !== "production"

  if (debug) {
    console.log("apiClient called with endpoint:", endpoint)
  }

  try {
    // Ensure headers exist in options
    const headers = fetchableOptions.headers || {}

    // Add auth headers if not explicitly disabled
    if (authOption !== false) {
      const authHeaders = await getAuthHeaders()
      Object.assign(headers, authHeaders)
    }

    // Add default headers
    const defaultHeaders = {
      "Content-Type": "application/json",
    }

    // Merge all headers
    const mergedHeaders = {
      ...defaultHeaders,
      ...headers,
    }

    // Build the request URL with API prefix
    const url = buildApiUrl(endpoint)

    const timeoutSignal = createFetchTimeoutSignal(timeoutMs)
    const combinedSignal =
      callerSignal && typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function"
        ? AbortSignal.any([callerSignal, timeoutSignal])
        : callerSignal || timeoutSignal

    // Create the final request options (omit non-fetch fields)
    const requestOptions = {
      ...fetchableOptions,
      headers: mergedHeaders,
      credentials: "include", // Include cookies for CORS requests
      signal: combinedSignal,
    }

    // Make the request
    if (debug) {
      console.log(`API Request to ${url}`, {
        method: requestOptions.method || "GET",
        headers: Object.keys(mergedHeaders),
        withCredentials: requestOptions.credentials === "include",
        authHeader: mergedHeaders["Authorization"] ? `${mergedHeaders["Authorization"].substring(0, 15)}...` : "none",
      })
    }

    const response = await fetch(url, requestOptions)

    // Handle errors
    if (!response.ok) {
    if (response.status === 401) {
    console.warn("Unauthorized API request - redirecting to login");
    tokenCache = { token: null, expiresAt: null };
      if (isBrowser) {
            const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/api/auth/login?returnTo=${returnTo}`;
            return null;
          }
        } else if (response.status === 405) {
        console.error("Method Not Allowed - the endpoint exists but doesn't support this HTTP method")
      } else if (response.status === 404) {
        console.error(`Endpoint not found: ${url}`)
      }

      // Try to get error details from response
      let errorDetails = null
      try {
        const contentType = response.headers.get("content-type")
        if (contentType && contentType.includes("application/json")) {
          errorDetails = await response.json()
          
          // Better handling for validation errors (422 Unprocessable Entity)
          if (response.status === 422) {
            console.error('Validation error detected:', errorDetails);
            
            // Format validation errors for better display
            if (errorDetails.detail) {
              if (Array.isArray(errorDetails.detail)) {
                // Handle array of validation errors
                const formattedErrors = errorDetails.detail.map(err => {
                  return `${err.loc?.join('.')} - ${err.msg}`;
                }).join('; ');
                errorDetails.formattedDetail = formattedErrors;
              } 
            }
          }
          
          // Extract database constraint errors from the detail field
          if (errorDetails?.detail) {
            if (typeof errorDetails.detail === 'string' && 
                (errorDetails.detail.includes('null value in column') || 
                 errorDetails.detail.includes('violates not-null constraint'))) {
              console.error('Database constraint error detected:', errorDetails.detail);
            }
          }
        } else {
          const textResponse = await response.text();
          errorDetails = { detail: textResponse };
          
          // Try to check if the text contains database constraint error information
          if (textResponse.includes('null value in column') || 
              textResponse.includes('violates not-null constraint')) {
            console.error('Database constraint error detected in text response:', textResponse);
          }
        }
      } catch (e) {
        // Ignore JSON parsing errors
        console.warn("Could not parse error response", e)
      }

      const error = new Error(errorDetails?.formattedDetail || errorDetails?.detail || `API error: ${response.status} ${response.statusText}`)
      error.status = response.status
      error.responseData = errorDetails
      throw error
    }

    // Handle 204 No Content response
    if (response.status === 204) {
      if (debug) console.log(`API Response for ${url}: 204 No Content (no body)`);
      return null;
    }

    // Check for empty response
    const responseContentType = response.headers.get("content-type")
    if (responseContentType && responseContentType.includes("application/json")) {
      const responseData = await response.json();
      if (debug) console.log(`API Response for ${url}:`, responseData);
      return responseData;
    } else {
      return await response.text()
    }
  } catch (error) {
    console.error("API request failed:", error)
    if (error?.name === "AbortError") {
      const err = new Error(
        "Request timed out or was aborted — check that NEXT_PUBLIC_API_URL is correct and the backend is reachable."
      )
      err.name = "AbortError"
      err.cause = error
      err.type = ErrorTypes.NETWORK
      throw err
    }
    throw error
  }
}

/**
 * Legacy request method for backward compatibility
 * @deprecated Use apiClient instead
 */
export async function legacyRequest(endpoint, options = {}) {
  return apiClient(endpoint, options)
}

// Export common API methods
export default {
  get: (endpoint, options = {}) => apiClient(endpoint, { method: "GET", ...options }),
  post: (endpoint, data, options = {}) =>
    apiClient(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
      ...options,
    }),
  put: (endpoint, data, options = {}) =>
    apiClient(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
      ...options,
    }),
  delete: (endpoint, options = {}) => apiClient(endpoint, { method: "DELETE", ...options }),
  // Legacy alias for backward compatibility
  request: legacyRequest,
}

