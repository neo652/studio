
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPass = process.env.BASIC_AUTH_PASS;

  // Check if environment variables are set
  if (!basicAuthUser || !basicAuthPass) {
    // This should ideally not happen in a properly configured production environment
    // Log an error and return a generic server error to avoid exposing details
    console.error(
      'CRITICAL: Basic Auth credentials are not configured in environment variables.'
    );
    // In a real scenario, you might want to return a less informative error to the client
    // or have a fallback page, but for now, a 500 is clear.
    return new NextResponse('Internal Server Error: Authentication not configured.', {
      status: 500,
    });
  }

  const authHeader = req.headers.get('authorization');

  if (authHeader) {
    const authValue = authHeader.split(' ')[1];
    // Ensure authValue is not undefined before attempting to use it
    if (authValue) {
        try {
            const [user, pass] = Buffer.from(authValue, 'base64').toString().split(':');
            if (user === basicAuthUser && pass === basicAuthPass) {
            return NextResponse.next();
            }
        } catch (e) {
            // If decoding fails, treat as invalid credentials
            console.error("Error decoding auth header:", e);
        }
    }
  }

  // If no/invalid auth header, request authentication
  const response = new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Restricted Area"',
    },
  });
  return response;
}

// Apply middleware to all routes
export const config = {
  matcher: '/:path*',
};
