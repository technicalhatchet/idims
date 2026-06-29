import { NextResponse } from 'next/server';
import {
  isPublicPath,
  isPortalPath,
  isTechPath,
} from './lib/routeAccess';

export function middleware(req) {
  const { pathname } = req.nextUrl;

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
