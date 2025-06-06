
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const basicAuth = request.headers.get('authorization');
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;

  // Bypass auth for *.cloudworkstations.dev domains
  const host = request.headers.get('host') || request.nextUrl.hostname;
  if (host && host.endsWith('.cloudworkstations.dev')) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Middleware: Bypassing auth for Cloud Workstations host: ${host}`);
    }
    return NextResponse.next();
  }

  if (!user || !pass) {
    console.error('Basic Auth credentials not set in environment variables for protected routes.');
    // Return a generic error rather than exposing missing config
    return new NextResponse('Configuration error.', { status: 500 });
  }

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    // Ensure authValue is not undefined before calling atob
    if (authValue) {
      try {
        const [providedUser, providedPass] = atob(authValue).split(':');
        if (providedUser === user && providedPass === pass) {
          return NextResponse.next();
        }
      } catch (e) {
        console.error("Error decoding Basic Auth credentials:", e);
        // Fall through to return 401 if decoding fails
      }
    }
  }

  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

// Limit middleware to specific paths
export const config = {
  matcher: ['/api/lifetime-stats/:path*', '/dashboard/:path*'], // Protect dashboard and its API
};

