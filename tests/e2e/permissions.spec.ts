import { test, expect } from '@playwright/test';
import { login } from './helpers';

const ANA_CEDULA = 'V-12345678';
const ANA_NOMBRE = 'Ana Rodríguez';       // Patient detail heading: "firstName lastName"
const ANA_LIST_LABEL = 'Rodríguez, Ana'; // Patient list: "lastName, firstName"

test.describe('Permisos (receptionist)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'receptionist');
  });

  test('no puede acceder a /configuracion/usuarios', async ({ page }) => {
    const response = await page.goto('/configuracion/usuarios');
    // Next.js notFound() returns HTTP 404
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Gestión de usuarios' })).not.toBeVisible();
  });

  test('no puede acceder a /configuracion/auditoria', async ({ page }) => {
    const response = await page.goto('/configuracion/auditoria');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: /auditoría/i })).not.toBeVisible();
  });

  test('no puede acceder a /pacientes/[id]/notas (notas stand-alone)', async ({ page }) => {
    // Find a patient ID first via the list
    await page.goto('/pacientes');
    await page.getByPlaceholder('Buscar por nombre, cédula o teléfono…').fill(ANA_CEDULA);
    await page.waitForURL(/q=/);
    await page.getByRole('link', { name: ANA_LIST_LABEL }).click();
    await page.waitForURL(/\/pacientes\/([^/]+)$/);

    // Extract the patient ID from the URL
    const url = page.url();
    const patientId = url.split('/pacientes/')[1];

    // Try to access the notes page directly
    const response = await page.goto(`/pacientes/${patientId}/notas`);
    expect(response?.status()).toBe(404);
  });

  test('no puede acceder a /pacientes/[id]/notas/nueva', async ({ page }) => {
    await page.goto('/pacientes');
    await page.getByPlaceholder('Buscar por nombre, cédula o teléfono…').fill(ANA_CEDULA);
    await page.waitForURL(/q=/);
    await page.getByRole('link', { name: ANA_LIST_LABEL }).click();
    await page.waitForURL(/\/pacientes\/([^/]+)$/);

    const url = page.url();
    const patientId = url.split('/pacientes/')[1];

    const response = await page.goto(`/pacientes/${patientId}/notas/nueva`);
    expect(response?.status()).toBe(404);
  });

  test('puede ver la ficha del paciente pero sin pestañas clínicas', async ({ page }) => {
    await page.goto('/pacientes');
    await page.getByPlaceholder('Buscar por nombre, cédula o teléfono…').fill(ANA_CEDULA);
    await page.waitForURL(/q=/);
    await page.getByRole('link', { name: ANA_LIST_LABEL }).click();
    await page.waitForURL(/\/pacientes\/[^/]+$/);

    // Visible tabs
    await expect(page.getByRole('button', { name: 'Datos personales' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Citas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adjuntos' })).toBeVisible();

    // Hidden tabs
    await expect(page.getByRole('button', { name: 'Historia clínica' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Notas clínicas' })).not.toBeVisible();
  });
});

test.describe('Permisos (doctor)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'doctor');
  });

  test('doctor no puede acceder a /configuracion/usuarios', async ({ page }) => {
    const response = await page.goto('/configuracion/usuarios');
    expect(response?.status()).toBe(404);
  });

  test('doctor no puede acceder a /configuracion/auditoria', async ({ page }) => {
    const response = await page.goto('/configuracion/auditoria');
    expect(response?.status()).toBe(404);
  });

  test('doctor puede ver la ficha y las pestañas clínicas', async ({ page }) => {
    await page.goto('/pacientes');
    await page.getByPlaceholder('Buscar por nombre, cédula o teléfono…').fill(ANA_CEDULA);
    await page.waitForURL(/q=/);
    await page.getByRole('link', { name: ANA_LIST_LABEL }).click();
    await page.waitForURL(/\/pacientes\/[^/]+$/);

    await expect(page.getByRole('button', { name: 'Historia clínica' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notas clínicas' })).toBeVisible();
  });
});

test.describe('Permisos (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin');
  });

  test('admin puede acceder a /configuracion/usuarios', async ({ page }) => {
    await page.goto('/configuracion/usuarios');
    await expect(page.getByRole('heading', { name: 'Gestión de usuarios' })).toBeVisible();
  });

  test('admin puede acceder a /configuracion/auditoria', async ({ page }) => {
    await page.goto('/configuracion/auditoria');
    await expect(page.locator('main')).toBeVisible();
  });
});
