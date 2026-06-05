/**
 * Client-side logout helpers shared by every logout entry point (the top-bar
 * button and the mobile sidebar item). Keeping the route and the
 * redirect rule in one place means there is a single logout "action" — adding
 * another button never duplicates the request logic.
 *
 * The server-side logout lives in `src/app/api/auth/logout/route.ts` and is
 * intentionally untouched.
 */

/** Hit the existing logout route, clearing the auth cookies server-side. */
export async function requestLogout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

/**
 * Where to send the user after logout. Demo visitors arrived from the public
 * landing page, so send them back there; real users return to the login screen.
 */
export function logoutDestination(isDemo: boolean): string {
  return isDemo ? '/' : '/login';
}
