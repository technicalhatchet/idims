import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { createMockSession } from '../utils/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Create a mock session using our auth utility
      createMockSession({
        email: email || 'user@example.com',
        token: token || undefined,
        name: 'Test User',
        roles: ['admin', 'user']
      });
      
      setSuccess(true);
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push('/debug-auth');
      }, 1500);
    } catch (err) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-6">Development Login</h1>
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          Login successful! Redirecting to debug page...
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block mb-2 font-medium">
            Email Address
          </label>
          <input
            id="email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="token" className="block mb-2 font-medium">
            Access Token (Optional)
          </label>
          <input
            id="token"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter actual JWT token or leave blank for mock token"
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Leave blank to use a mock token for testing
          </p>
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login for Testing'}
        </button>
      </form>
      
      <div className="mt-4 text-center">
        <Link href="/debug-auth" className="text-blue-500 hover:underline">
          Go to Debug Page
        </Link>
      </div>
    </div>
  );
}