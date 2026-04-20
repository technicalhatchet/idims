import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getSession, clearSession } from '../utils/auth';

export default function DevDashboard() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadSession() {
      try {
        const userSession = await getSession();
        setSession(userSession);
      } catch (error) {
        console.error("Failed to load session:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">IDIMS Development Dashboard</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
        {loading ? (
          <p>Checking authentication status...</p>
        ) : session ? (
          <div className="bg-green-100 p-3 rounded border border-green-300 mb-4">
            <p className="font-semibold text-green-800">✅ Authenticated</p>
            <p>User: {session.user?.email || 'Unknown'}</p>
            <p>Token: {session.accessToken ? `${session.accessToken.substring(0, 15)}...` : 'None'}</p>
            <button 
              onClick={() => {
                clearSession();
                setSession(null);
              }}
              className="mt-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="bg-yellow-100 p-3 rounded border border-yellow-300 mb-4">
            <p className="font-semibold text-yellow-800">⚠️ Not authenticated</p>
            <Link href="/login" className="mt-2 inline-block bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
              Login (Development)
            </Link>
          </div>
        )}
        
        <div className="flex flex-wrap gap-4 mt-4">
          <Link href="/" className="inline-block bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded">
            Back to Home
          </Link>
          <Link href="/debug-auth" className="inline-block bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded">
            Auth Debug Page
          </Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">API Endpoints</h2>
          <ul className="space-y-2">
            <li>
              <a 
                href="http://localhost:8000/api/health" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Health Check (Public)
              </a>
            </li>
            <li>
              <a 
                href="http://localhost:8000/api/health-auth" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Auth Health Check (Protected)
              </a>
            </li>
            <li>
              <a 
                href="http://localhost:8000/api/work-orders" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Work Orders API (Protected)
              </a>
            </li>
            <li>
              <a 
                href="http://localhost:8000/api/debug-auth" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Debug Auth API (Protected)
              </a>
            </li>
          </ul>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Development Tools</h2>
          <ul className="space-y-2">
            <li>
              <Link 
                href="/api-test" 
                className="text-blue-500 hover:underline"
              >
                API Test Page
              </Link>
            </li>
            <li>
              <a 
                href="http://localhost:8000/api/docs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Backend API Docs (Swagger)
              </a>
            </li>
          </ul>
          
          <h3 className="text-lg font-semibold mt-6 mb-2">Test Credentials</h3>
          <div className="bg-gray-100 p-3 rounded">
            <p><strong>Email:</strong> user@example.com</p>
            <p><strong>Mock Token:</strong> Will be generated automatically</p>
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h2 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Development Use Only</h2>
        <p>This dashboard is for development purposes only and should not be used in production.</p>
      </div>
    </div>
  );
} 