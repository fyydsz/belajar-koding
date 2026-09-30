import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const pathname = request.nextUrl.pathname;

  if (!token && pathname.startsWith('/dashboard')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (token && (pathname === '/login' || pathname === '/register')) {
    const redirectUrl = request.nextUrl.clone();
    const target = request.nextUrl.searchParams.get('redirect') || '/dashboard';
    redirectUrl.pathname = target.startsWith('/') ? target : '/dashboard';
    redirectUrl.searchParams.delete('redirect');
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/register',
  ],
};
