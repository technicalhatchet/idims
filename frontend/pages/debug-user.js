import { useUser } from '@auth0/nextjs-auth0/client';
import { withPageAuthRequired } from '../utils/auth0-helpers';
import { useEffect, useState } from 'react';
import Link from 'next/link';

function DebugUserPage() {
  const { user, error, isLoading } = useUser();
  const [possibleRoles, setPossibleRoles] = useState([]);
  const [effectiveRole, setEffectiveRole] = useState('');
  
  // Hardcode specific users as admin by their user ID
  // This is a temporary solution until Auth0 roles are properly set up
  const hardcodedAdmins = [
    'google-oauth2|110674600011943435167' // Rhett Nysko's Google ID
  ];
  
  useEffect(() => {
    if (user) {
      console.log('Full user object for debugging:', user);
      
      // Gather all possible places where roles might be stored
      const roles = [
        { name: 'user.role', value: user.role },
        { name: 'user.roles', value: user.roles },
        { name: 'user["https://servicebusiness.com/roles"][0]', value: user['https://servicebusiness.com/roles']?.[0] },
        { name: 'user["https://idimsapi/roles"][0]', value: user['https://idimsapi/roles']?.[0] },
        { name: 'user["https://idimsapi/app_metadata"].roles[0]', value: user['https://idimsapi/app_metadata']?.roles?.[0] },
        { name: 'user["https://servicebusiness.com/app_metadata"].role', value: user['https://servicebusiness.com/app_metadata']?.role },
        { name: 'user["https://servicebusiness.com/app_metadata"].roles[0]', value: user['https://servicebusiness.com/app_metadata']?.roles?.[0] },
        { name: 'user["https://example.com/roles"][0]', value: user['https://example.com/roles']?.[0] },
        { name: 'user["roles"][0]', value: user['roles']?.[0] },
        { name: 'user["app_metadata"].role', value: user['app_metadata']?.role },
        { name: 'Hardcoded admin by user ID', value: hardcodedAdmins.includes(user.sub) ? 'admin' : null },
      ];
      
      setPossibleRoles(roles.filter(r => r.value));
      
      // Get effective role used across the application
      const effectiveRole = 
        user['https://servicebusiness.com/roles']?.[0] || 
        user['https://idimsapi/roles']?.[0] ||
        user['https://idimsapi/app_metadata']?.roles?.[0] ||
        user.app_metadata?.roles?.[0] ||
        user.roles?.[0] ||
        (hardcodedAdmins.includes(user.sub) ? 'admin' : 'client');
      
      setEffectiveRole(effectiveRole);
    }
  }, [user]);

  if (isLoading) {
    return <div>Loading user information...</div>;
  }
  
  if (error) {
    return <div>Error: {error.message}</div>;
  }
  
  if (!user) {
    return <div>Not authenticated</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">User Debug Information</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Basic User Info</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>Name:</strong> {user.name || 'Not available'}
          </div>
          <div>
            <strong>Email:</strong> {user.email || 'Not available'}
          </div>
          <div>
            <strong>User ID:</strong> {user.sub || 'Not available'}
          </div>
          <div>
            <strong>Email Verified:</strong> {user.email_verified ? 'Yes' : 'No'}
          </div>
        </div>
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Role Information</h2>
        <div className="mb-4 p-4 bg-green-100 border border-green-200 rounded">
          <strong className="block text-lg mb-2">ROLE: {effectiveRole.toUpperCase()}</strong>
          <p className="text-sm text-gray-600">
            This is the role that will be used throughout the application for this user.
          </p>
        </div>
        
        {possibleRoles.length > 0 ? (
          <div className="overflow-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="py-2 px-4 text-left">Property Path</th>
                  <th className="py-2 px-4 text-left">Value</th>
                </tr>
              </thead>
              <tbody>
                {possibleRoles.map((role, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="py-2 px-4 font-mono text-sm">{role.name}</td>
                    <td className="py-2 px-4">{role.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-red-600 font-semibold">
            No role information found in user object!
          </div>
        )}
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Full User Object</h2>
        <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Role-Based Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/dashboard" className="p-4 bg-blue-500 text-white rounded hover:bg-blue-600">
            Dashboard (All Users)
          </Link>
          <Link href="/clients" className="p-4 bg-purple-500 text-white rounded hover:bg-purple-600">
            Clients (Admin Only)
          </Link>
          <Link href="/technicians" className="p-4 bg-green-500 text-white rounded hover:bg-green-600">
            Technicians (Admin Only)
          </Link>
        </div>
      </div>
    </div>
  );
}

export default withPageAuthRequired(DebugUserPage); 