import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const pathname = request.nextUrl.pathname;

  const role = request.cookies.get('auth_role')?.value;

  if (!token && pathname.startsWith('/dashboard')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect root /dashboard to specific role dashboard
  if (token && pathname === '/dashboard') {
    const redirectUrl = request.nextUrl.clone();
    if (role === 'admin') {
      redirectUrl.pathname = '/dashboard/admin';
    } else if (role === 'mentor') {
      redirectUrl.pathname = '/dashboard/mentor';
    } else {
      redirectUrl.pathname = '/dashboard/siswa';
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (token && (pathname === '/login' || pathname === '/register')) {
    const redirectUrl = request.nextUrl.clone();
    const target = request.nextUrl.searchParams.get('redirect');
    if (target && target.startsWith('/') && target !== '/dashboard') {
      redirectUrl.pathname = target;
    } else {
      redirectUrl.pathname =
        role === 'admin'
          ? '/dashboard/admin'
          : role === 'mentor'
            ? '/dashboard/mentor'
            : '/dashboard/siswa';
    }
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
