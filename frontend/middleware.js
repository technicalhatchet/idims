import { NextResponse } from 'next/server';
import {
  isPublicPath,
  isPortalPath,
  isTechPath,
  isSolomonStandaloneAllowedPath,
  isSolomonStandaloneMode,
} from './lib/routeAccess';

function solomonStandaloneResponse(req, pathname) {
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/solomon', req.url));
  }

  if (isSolomonStandaloneAllowedPath(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/solomon', req.url));
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  if (isSolomonStandaloneMode()) {
    return solomonStandaloneResponse(req, pathname);
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.get('appSession.0') || req.cookies.get('appSession');

  if (isTechPath(pathname)) {
    if (!hasSession) {
      const loginUrl = new URL('/api/auth/login', req.url);
      loginUrl.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (isPortalPath(pathname)) {
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
