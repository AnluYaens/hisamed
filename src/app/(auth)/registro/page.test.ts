import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

// Self-service registration is disabled during the invite-only pilot: the
// /registro route must no longer render a registration form, only redirect to
// the landing page's access-request funnel.
const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import RegistroPage from './page';

describe('GET /registro', () => {
  it('redirects to the landing page instead of serving a registration form', () => {
    RegistroPage();

    expect(mocks.redirect).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith('/?from=register');
  });

  it('no longer imports or renders the registration form component', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./page.tsx', import.meta.url)),
      'utf8',
    );
    expect(source).not.toContain('register-form');
    expect(source).not.toContain('RegisterForm');
  });
});
