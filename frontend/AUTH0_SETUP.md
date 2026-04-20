# Auth0 Setup Guide

This document outlines the Auth0 configuration needed for the IDIMS application.

## Required Environment Variables

Create a `.env.local` file in the frontend directory with the following Auth0 configuration:

```
# Auth0 Configuration
AUTH0_SECRET='a-long-random-string-at-least-32-characters'
AUTH0_BASE_URL='http://localhost:3000'
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