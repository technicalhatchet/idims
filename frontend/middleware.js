import { NextResponse } from 'next/server';

const PORTAL_ROUTES = ['/cxdashboard'];

const PUBLIC_ROUTES = [
  '/cxdashboard/login',
  '/cxdashboard/register',
  '/book',
  '/book-test',
  '/api/public',
  '/api/auth',
  '/api/portal',
];

function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

function isPortalRoute(pathname) {
  // Don't block login/register pages
  if (pathname.startsWith('/cxdashboard/login') || pathname.startsWith('/cxdashboard/register')) {
    return false;
  }
  return PORTAL_ROUTES.some(route => pathname.startsWith(route));
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Always let public routes through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Portal routes — check for portal session cookie
  if (isPortalRoute(pathname)) {
    // Auth0 splits session across appSession.0, appSession.1 etc
    const hasSession = req.cookies.get('appSession.0') || req.cookies.get('appSession');
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