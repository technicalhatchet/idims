import { NextResponse } from 'next/server';

// Routes that require technician/admin/manager role (not clients)
const TECH_ROUTES = [
  '/techboard',
  '/techdashboard',
  '/work_orders',
  '/clients',
  '/appointments',
  '/payments',
  '/invoices',
  '/quotes',
  '/reports',
  '/settings',
  '/dashboard',
];

// Client portal routes
const PORTAL_ROUTES = ['/cxdashboard'];

// Completely public routes (no auth needed)
const PUBLIC_ROUTES = [
  '/cxdashboard/login',
  '/cxdashboard/register',
  '/book',
  '/book-test',
  '/api/public',
  '/api/auth',
  '/api/portal',
  '/',
  '/about',
  '/contact',
  '/pricing',
  '/auth-router',
  '/unauthorized',
];

function isPublicRoute(pathname) {
  // Check exact match for root
  if (pathname === '/') return true;
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

function isPortalRoute(pathname) {
  // Don't block login/register pages
  if (pathname.startsWith('/cxdashboard/login') || pathname.startsWith('/cxdashboard/register')) {
    return false;
  }
  return PORTAL_ROUTES.some(route => pathname.startsWith(route));
}

function isTechRoute(pathname) {
  return TECH_ROUTES.some(route => pathname.startsWith(route));
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Always let public routes through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check for Auth0 session cookie
  const hasSession = req.cookies.get('appSession.0') || req.cookies.get('appSession');
  
  // Tech routes — require session, role check happens at page level
  if (isTechRoute(pathname)) {
    if (!hasSession) {
      // No session - redirect to main login
      const loginUrl = new URL('/api/auth/login', req.url);
      loginUrl.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Session exists - let through, page-level useAuthRedirect will check role
    return NextResponse.next();
  }

  // Portal routes — check for portal session cookie
  if (isPortalRoute(pathname)) {
    if (!hasSession) {
      const loginUrl = new URL('/cxdashboard/login', req.url);
      loginUrl.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.webp).*)',
  ],
};