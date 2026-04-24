import type { Page } from '@playwright/test';

export const CREDENTIALS = {
  admin: { email: 'admin@fertilityplus.com', password: 'clinicamvp2026' },
  doctor: { email: 'dra.garcia@fertilityplus.com', password: 'clinicamvp2026' },
  receptionist: { email: 'carmen.lopez@fertilityplus.com', password: 'clinicamvp2026' },
} as const;

export async function login(page: Page, role: keyof typeof CREDENTIALS) {
  const { email, password } = CREDENTIALS[role];
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL('/');
}
