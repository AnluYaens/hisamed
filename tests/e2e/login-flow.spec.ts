import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('login con credenciales correctas redirige al dashboard', async ({ page }) => {
  await login(page, 'admin');
  await expect(page).toHaveURL('/');
  // Dashboard heading must be visible
  await expect(page.locator('main')).toBeVisible();
});

test('login con credenciales incorrectas muestra error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('noexiste@fertilityplus.com');
  await page.getByLabel('Contraseña').fill('incorrecta1234');
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL('/login');
});

test('acceder a /pacientes sin sesión redirige a /login', async ({ page }) => {
  await page.goto('/pacientes');
  await expect(page).toHaveURL(/\/login/);
});

test('acceder a /agenda sin sesión redirige a /login', async ({ page }) => {
  await page.goto('/agenda');
  await expect(page).toHaveURL(/\/login/);
});

test('login como doctor redirige al dashboard', async ({ page }) => {
  await login(page, 'doctor');
  await expect(page).toHaveURL('/');
});

test('login como recepcionista redirige al dashboard', async ({ page }) => {
  await login(page, 'receptionist');
  await expect(page).toHaveURL('/');
});
