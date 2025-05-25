
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/lifetime-stats')) {
    const basicAuth = request.headers.get('authorization');
    const user = process.env.BASIC_AUTH_USER;
    const pass = process.env.BASIC_AUTH_PASS;

    if (!user || !pass) {
      console.error('Basic Auth credentials not set in environment variables.');
      // Return a generic error rather than exposing missing config
      return new NextResponse('Configuration error.', { status: 500 });
    }

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      const [providedUser, providedPass] = atob(authValue).split(':');

      if (providedUser === user && providedPass === pass) {
        return NextResponse.next();
      }
    }

    return new NextResponse('Authentication required.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  return NextResponse.next();
}

// Limit middleware to specific paths
export const config = {
  matcher: ['/api/lifetime-stats/:path*'], // Protect only the lifetime-stats API
};
