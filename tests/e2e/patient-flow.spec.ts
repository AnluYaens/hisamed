import { test, expect } from '@playwright/test';
import { login } from './helpers';

// First patient in seed data; used for read tests
const ANA_CEDULA = 'V-12345678';
const ANA_NOMBRE = 'Ana Rodríguez';          // As shown in patient detail heading
const ANA_LIST_LABEL = 'Rodríguez, Ana';     // Patient list renders "lastName, firstName"

test.describe('Patient flow (receptionist)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'receptionist');
  });

  test('crear paciente nuevo con datos completos', async ({ page }) => {
    const uniqueId = `TEST-${Date.now()}`;

    await page.goto('/pacientes/nuevo');
    await expect(page.getByRole('heading', { name: 'Registrar nuevo paciente' })).toBeVisible();

    // Personal data tab; required fields live here.
    await page.selectOption('#id_type', 'cedula');
    await page.fill('#id_number', uniqueId);
    await page.fill('#first_name', 'María Test');
    await page.fill('#last_name', 'Paciente E2E');
    await page.fill('#date_of_birth', '1992-06-15');
    await page.selectOption('#sex', 'F');

    // Submit from the Personal tab; the form conditionally renders only the
    // active tab's fields, so navigating away before submitting would drop them.
    await page.getByRole('button', { name: 'Registrar paciente' }).click();

    // On success, redirected to patient detail page
    await page.waitForURL(/\/pacientes\//);
    // Patient detail heading shows "firstName lastName"
    await expect(page.getByRole('heading', { name: 'María Test Paciente E2E' })).toBeVisible();
  });

  test('buscar paciente por cédula', async ({ page }) => {
    await page.goto('/pacientes');
    await page.getByPlaceholder('Buscar por nombre, cédula o teléfono…').fill(ANA_CEDULA);
    // Search updates URL and re-renders list server-side
    await page.waitForURL(/q=/);
    // List shows "lastName, firstName" format
    await expect(page.getByRole('link', { name: ANA_LIST_LABEL })).toBeVisible();
  });

  test('abrir ficha del paciente', async ({ page }) => {
    await page.goto('/pacientes');
    await page.getByPlaceholder('Buscar por nombre, cédula o teléfono…').fill(ANA_CEDULA);
    await page.waitForURL(/q=/);
    await page.getByRole('link', { name: ANA_LIST_LABEL }).click();

    await expect(page).toHaveURL(/\/pacientes\/[^/]+$/);
    // Patient detail heading shows "firstName lastName"
    await expect(page.getByRole('heading', { name: ANA_NOMBRE })).toBeVisible();
  });

  test('receptionist no puede ver la pestaña Historia clínica', async ({ page }) => {
    await page.goto('/pacientes');
    await page.getByPlaceholder('Buscar por nombre, cédula o teléfono…').fill(ANA_CEDULA);
    await page.waitForURL(/q=/);
    await page.getByRole('link', { name: ANA_LIST_LABEL }).click();
    await page.waitForURL(/\/pacientes\/[^/]+$/);

    // These tabs are not rendered for receptionists
    await expect(page.getByRole('button', { name: 'Historia clínica' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Notas clínicas' })).not.toBeVisible();

    // Tabs they CAN see
    await expect(page.getByRole('button', { name: 'Datos personales' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Citas' })).toBeVisible();
  });
});
