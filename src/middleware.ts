
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  let hostnameForCheck: string | null = null;
  const xForwardedHost = request.headers.get('x-forwarded-host');
  const nextUrlHostname = request.nextUrl.hostname;

  if (xForwardedHost) {
    // x-forwarded-host can be a comma-separated list, take the first one and remove port
    hostnameForCheck = xForwardedHost.split(',')[0].trim().split(':')[0];
  } else if (nextUrlHostname) {
    hostnameForCheck = nextUrlHostname.split(':')[0]; // Remove port if present
  }

  let bypassAuth = false;

  if (hostnameForCheck && typeof hostnameForCheck === 'string' && hostnameForCheck.toLowerCase().endsWith('.cloudworkstations.dev')) {
    bypassAuth = true;
  }
  
  if (bypassAuth) {
    const bypassResponse = NextResponse.next();
    bypassResponse.headers.set('X-Detected-Hostname', hostnameForCheck || 'N/A');
    bypassResponse.headers.set('X-X-Forwarded-Host', xForwardedHost || 'N/A');
    bypassResponse.headers.set('X-Next-Url-Hostname', nextUrlHostname || 'N/A');
    bypassResponse.headers.set('X-Auth-Bypass-Decision', 'Allowed-CloudWorkstation');
    return bypassResponse;
  }

  // --- Standard Basic Auth Logic ---
  const basicAuth = request.headers.get('authorization');
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;

  if (!user || !pass) {
    const errorResponse = new NextResponse('Configuration error.', { status: 500 });
    errorResponse.headers.set('X-Detected-Hostname', hostnameForCheck || 'N/A');
    errorResponse.headers.set('X-X-Forwarded-Host', xForwardedHost || 'N/A');
    errorResponse.headers.set('X-Next-Url-Hostname', nextUrlHostname || 'N/A');
    errorResponse.headers.set('X-Auth-Bypass-Decision', 'Denied-ConfigError');
    return errorResponse;
  }

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    if (authValue) {
      try {
        const [providedUser, providedPass] = atob(authValue).split(':');
        if (providedUser === user && providedPass === pass) {
          const successResponse = NextResponse.next();
          successResponse.headers.set('X-Detected-Hostname', hostnameForCheck || 'N/A');
          successResponse.headers.set('X-X-Forwarded-Host', xForwardedHost || 'N/A');
          successResponse.headers.set('X-Next-Url-Hostname', nextUrlHostname || 'N/A');
          successResponse.headers.set('X-Auth-Bypass-Decision', 'Denied-AuthSuccess');
           return successResponse;
        }
      } catch (e) {
        // Fall through to return 401 if decoding fails or credentials don't match
      }
    }
  }

  const authFailedResponse = new NextResponse('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
  authFailedResponse.headers.set('X-Detected-Hostname', hostnameForCheck || 'N/A');
  authFailedResponse.headers.set('X-X-Forwarded-Host', xForwardedHost || 'N/A');
  authFailedResponse.headers.set('X-Next-Url-Hostname', nextUrlHostname || 'N/A');
  authFailedResponse.headers.set('X-Auth-Bypass-Decision', 'Denied-AuthFailedOrNotProvided');
  return authFailedResponse;
}

export const config = {
  matcher: ['/api/lifetime-stats/:path*', '/dashboard/:path*'],
};
