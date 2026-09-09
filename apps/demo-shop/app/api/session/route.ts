import { NextResponse } from 'next/server';
import { behaviorFor, currentVariant } from '../../../lib/variant';

export function POST() {
  const behavior = behaviorFor(currentVariant());
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set('truthshop_session', 'demo-session-token', {
    httpOnly: true,
    sameSite: behavior.sessionSameSite,
    secure: behavior.sessionSameSite === 'none',
    path: '/',
    maxAge: 3600,
  });
  return response;
}
