import { NextRequest, NextResponse } from 'next/server';
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';
import { docsContentRoute, docsRoute } from '@/lib/shared';

const { rewrite: rewriteDocs } = rewritePath(
  `${docsRoute}{/*path}`,
  `${docsContentRoute}{/*path}/content.md`,
);
const { rewrite: rewriteSuffix } = rewritePath(
  `${docsRoute}{/*path}.md`,
  `${docsContentRoute}{/*path}/content.md`,
);

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get('auth_token')?.value;
  const role = request.cookies.get('auth_role')?.value;

  const getRoleDashboard = (userRole?: string) => {
    if (userRole === 'admin') return '/dashboard/admin';
    if (userRole === 'mentor') return '/dashboard/mentor';
    return '/dashboard/siswa';
  };

  if (!token && pathname.startsWith('/dashboard')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (token && pathname === '/dashboard') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = getRoleDashboard(role);
    return NextResponse.redirect(redirectUrl);
  }

  if (token && role && pathname.startsWith('/dashboard')) {
    if (pathname.startsWith('/dashboard/admin') && role !== 'admin') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = getRoleDashboard(role);
      return NextResponse.redirect(redirectUrl);
    }

    if (
      (pathname.startsWith('/dashboard/mentor') || pathname.startsWith('/dashboard/dosen')) &&
      role !== 'mentor' &&
      role !== 'admin'
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/dashboard/siswa';
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (token && (pathname === '/login' || pathname === '/register')) {
    const redirectUrl = request.nextUrl.clone();
    const target = request.nextUrl.searchParams.get('redirect');
    if (target && target.startsWith('/') && target !== '/dashboard') {
      redirectUrl.pathname = target;
    } else {
      redirectUrl.pathname = getRoleDashboard(role);
    }
    redirectUrl.searchParams.delete('redirect');
    return NextResponse.redirect(redirectUrl);
  }

  const result = rewriteSuffix(pathname);
  if (result) {
    return NextResponse.rewrite(new URL(result, request.nextUrl));
  }

  if (isMarkdownPreferred(request)) {
    const result = rewriteDocs(pathname);

    if (result) {
      return NextResponse.rewrite(new URL(result, request.nextUrl), {
        // this URL has two representations, selected by `Accept`
        headers: { Vary: 'Accept' },
      });
    }
  }

  return NextResponse.next();
}
