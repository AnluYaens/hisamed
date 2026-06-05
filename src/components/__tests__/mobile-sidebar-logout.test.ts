import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestLogout, logoutDestination } from '@/lib/auth/logout-client';

// This project's vitest runs in the `node` environment with no DOM/testing
// library, so we can't mount the React tree. Instead we assert (a) the shared
// logout action the sidebar item calls, and (b) that the mobile sidebar source
// actually wires that action to a "Cerrar sesión" item — together this pins the
// behaviour the change is responsible for.

const mobileSidebarSource = readFileSync(
  resolve(__dirname, '../mobile-sidebar.tsx'),
  'utf8',
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('logout action reused by the mobile sidebar', () => {
  it('POSTs to the existing logout route', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await requestLogout();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });

  it('routes real users to /login and demo visitors back to the landing page', () => {
    expect(logoutDestination(false)).toBe('/login');
    expect(logoutDestination(true)).toBe('/');
  });
});

describe('mobile sidebar logout item', () => {
  it('renders a "Cerrar sesión" item with the LogOut icon', () => {
    expect(mobileSidebarSource).toContain('Cerrar sesión');
    expect(mobileSidebarSource).toMatch(/LogOut/);
  });

  it('calls the shared logout action instead of duplicating the fetch', () => {
    expect(mobileSidebarSource).toContain(
      "from '@/lib/auth/logout-client'",
    );
    expect(mobileSidebarSource).toContain('requestLogout');
    // The raw route must not be re-implemented in the component.
    expect(mobileSidebarSource).not.toContain('/api/auth/logout');
  });

  it('separates the logout item from the nav with a top border divider', () => {
    expect(mobileSidebarSource).toMatch(/border-t/);
  });
});
