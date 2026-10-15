# Auth0 Setup Guide

This document outlines the Auth0 configuration needed for the IDIMS application.

## Required Environment Variables

Create a `.env.local` file in the frontend directory with the following Auth0 configuration:

IDIMS dev runs on **port 3001** by default (`npm run dev`) so it does not collide with idfms on **3000**. `AUTH0_BASE_URL` is a **fallback** when the request host is unknown; in production `resolveAuth0BaseUrl` (see `frontend/lib/resolveAuth0BaseUrl.js`) sets Auth0 `baseURL` from the incoming request host so login, callback, and logout stay on the **same origin** as the browser.

### Atomic Repair production hosts (single Auth0 application)

When `HOST_BASED_ROUTING` is enabled, marketing, portal, and IDIMS each have their own hostname but share one Vercel project and one Auth0 SPA. Register **all** of the following in the Auth0 dashboard for the IDIMS application. **Updating this file does not change Auth0** — each URL must be added manually in the tenant.

| Host | Allowed Callback URLs | Allowed Logout URLs | Allowed Web Origins |
|------|-------------------------|---------------------|---------------------|
| `https://atomicrepair419.com` | `https://atomicrepair419.com/api/auth/callback` | `https://atomicrepair419.com/api/auth/logout` | `https://atomicrepair419.com` |
| `https://www.atomicrepair419.com` | `https://www.atomicrepair419.com/api/auth/callback` | `https://www.atomicrepair419.com/api/auth/logout` | `https://www.atomicrepair419.com` |
| `https://portal.atomicrepair419.com` | `https://portal.atomicrepair419.com/api/auth/callback` | `https://portal.atomicrepair419.com/api/auth/logout` | `https://portal.atomicrepair419.com` |
| `https://idims.atomicrepair419.com` | `https://idims.atomicrepair419.com/api/auth/callback` | `https://idims.atomicrepair419.com/api/auth/logout` | `https://idims.atomicrepair419.com` |

Also register any Vercel preview or staging host you use for testing (for example `https://v0-idims.vercel.app` with the same `/api/auth/callback` and `/api/auth/logout` path pattern).

After subdomain cutover, confirm login and logout on **both** portal and IDIMS hosts; a missing callback or web origin typically surfaces as Auth0 `redirect_uri` or CORS errors on that host only.

```
# Auth0 Configuration
AUTH0_SECRET='a-long-random-string-at-least-32-characters'
AUTH0_BASE_URL='http://localhost:3001'
NEXT_PUBLIC_BASE_URL='http://localhost:3001'
AUTH0_ISSUER_BASE_URL='https://your-tenant.auth0.com'
AUTH0_CLIENT_ID='your-auth0-client-id'
AUTH0_CLIENT_SECRET='your-auth0-client-secret'
AUTH0_AUDIENCE='your-auth0-api-identifier'
AUTH0_SCOPE='openid profile email'

# API Configuration
NEXT_PUBLIC_API_URL='http://localhost:8000/api'
```

## Production vs Development Environment

In development mode, the application is set up to fall back to mock authentication if Auth0 is not properly configured. This allows you to develop and test without having to set up Auth0.

In production, Auth0 authentication is required for protected routes.

## Role-Based Access Control

The application uses Auth0 roles for controlling access to different parts of the application. Make sure your Auth0 configuration includes the following roles:

- `admin`: Full access to all features
- `manager`: Access to most features except system configuration
- `technician`: Access to work orders, scheduling, and client information
- `client`: Limited access to their own information and service history

## Setting Up Auth0 Rules for App Metadata

To automatically set roles, create the following rule in Auth0:

```javascript
function (user, context, callback) {
  // Assign roles based on email domain or other criteria
  const namespace = 'https://your-app-domain.com';
  
  if (!user.app_metadata) {
    user.app_metadata = {};
  }
  
  // Example: assign admin role to specific emails
  if (user.email && (
      user.email.endsWith('@youradmindomain.com') ||
      ['admin1@example.com', 'admin2@example.com'].includes(user.email)
    )) {
    user.app_metadata.role = 'admin';
  }
  
  // Example: assign roles based on email domain
  else if (user.email && user.email.endsWith('@technicians.example.com')) {
    user.app_metadata.role = 'technician';
  }
  
  // Default role
  else if (!user.app_metadata.role) {
    user.app_metadata.role = 'client';
  }
  
  // Update app_metadata
  auth0.users.updateAppMetadata(user.user_id, user.app_metadata)
    .then(() => {
      context.idToken[namespace + '/role'] = user.app_metadata.role;
      context.accessToken[namespace + '/role'] = user.app_metadata.role;
      callback(null, user, context);
    })
    .catch((err) => {
      callback(err);
    });
} 