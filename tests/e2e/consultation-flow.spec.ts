import { test, expect } from '@playwright/test';
import { toDateStr } from '../../src/lib/dates';
import { login } from './helpers';

const ANA_CEDULA = 'V-12345678';
const ANA_NOMBRE = 'Ana Rodríguez';
// Patient list renders "lastName, firstName"; used for list-row link selectors
const ANA_LIST_LABEL = 'Rodríguez, Ana';

function addCalendarDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
}

test.describe('Consultation flow (doctor)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'doctor');
  });

  test('puede ver la agenda del día', async ({ page }) => {
    await page.goto('/agenda');
    await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
    // Agenda controls and date title must be present
    await expect(page.locator('main')).toBeVisible();
  });

  test('marcar asistencia de un paciente (si hay citas disponibles)', async ({ page }) => {
    await page.goto('/agenda');
    // Look for any appointment action button; status depends on time of day and seed data
    const actionButton = page
      .getByRole('button', { name: /Confirmar|Llegó|Iniciar consulta/i })
      .first();

    if (await actionButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const label = await actionButton.textContent();
      await actionButton.click();
      // After status update, that same button text should disappear
      await expect(
        page.getByRole('button', { name: label ?? '' }).first(),
      ).not.toBeVisible({ timeout: 5_000 });
    }
    // If no actionable appointments exist (all in terminal state or agenda is empty),
    // the test passes vacuously; this is expected outside clinic hours.
  });

  test('abrir ficha de paciente desde la agenda', async ({ page }) => {
    await page.goto('/agenda');
    // Patient name links appear as blue links in each appointment card
    const patientLink = page.getByRole('link', { name: ANA_NOMBRE }).first();

    if (await patientLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const href = await patientLink.getAttribute('href');
      await page.goto(href!);
    } else {
      // Navigate directly if Ana is not in today's agenda.
      // Use goto with the query param (server-side search) so the PatientSearchBar
      // debounce loop doesn't interfere with the subsequent navigation.
      await page.goto(`/pacientes?q=${encodeURIComponent(ANA_CEDULA)}`);
      const link = page.getByRole('link', { name: ANA_LIST_LABEL }).first();
      await expect(link).toBeVisible({ timeout: 5_000 });
      const href = await link.getAttribute('href');
      // Use page.goto instead of link.click so the hard navigation cannot be
      // overridden by the search bar's 300ms debounce router.push.
      await page.goto(href!);
    }

    await page.waitForURL(/\/pacientes\/[^/]+$/);
    await expect(page.getByRole('heading', { name: ANA_NOMBRE }).first()).toBeVisible();
  });

  test('crear nota de evolución SOAP, firmarla y verificar que queda bloqueada', async ({
    page,
  }) => {
    // Navigate to Ana Rodríguez's patient page
    await page.goto('/pacientes');
    await page.getByPlaceholder('Buscar por nombre, cédula o teléfono…').fill(ANA_CEDULA);
    await page.waitForURL(/q=/);
    // Patient list shows "lastName, firstName"; use that format for the link
    await page.getByRole('link', { name: ANA_LIST_LABEL }).click();
    await page.waitForURL(/\/pacientes\/[^/]+$/);

    // Click on the "Notas clínicas" tab
    await page.getByRole('button', { name: 'Notas clínicas' }).click();

    // Click "Nueva nota" button
    await page.getByRole('link', { name: 'Nueva nota' }).click();
    await page.waitForURL(/\/pacientes\/[^/]+\/notas\/nueva$/);
    await expect(page.getByRole('heading', { name: 'Nueva nota de evolución' })).toBeVisible();

    // Date is pre-filled by the server using the clinic timezone.
    await expect(page.locator('#note_date')).not.toHaveValue('');

    // Fill SOAP fields
    await page.locator('#chief_complaint').fill('Paciente para control ginecológico rutinario E2E.');
    await page.locator('#subjective').fill('Paciente refiere ciclos regulares. Sin molestias.');
    await page.locator('#objective').fill('Signos vitales normales. Abdomen sin hallazgos.');
    await page.locator('#assessment').fill('Paciente en buen estado general.');
    await page.locator('#plan').fill('Control en 3 meses. Papanicolaou anual.');

    // Save as draft first
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    // After saving draft, the URL should update to the new note's URL
    await page.waitForURL(/\/pacientes\/[^/]+\/notas\/[^/]+$/);

    // Now sign the note
    await page.getByRole('button', { name: 'Firmar nota' }).click();
    // Confirmation dialog appears
    await expect(page.getByRole('heading', { name: 'Firmar nota de evolución' })).toBeVisible();
    await page.getByRole('button', { name: 'Sí, firmar nota' }).click();

    // After signing, navigates to read-only view of the same note
    await page.waitForURL(/\/pacientes\/[^/]+\/notas\/[^/]+$/);

    // The "Firmar nota" button must no longer be present (note is immutable)
    await expect(page.getByRole('button', { name: 'Firmar nota' })).not.toBeVisible();
    // The heading reflects read-only mode; ClinicalNoteView may add a second heading.
    await expect(page.locator('h1').filter({ hasText: 'Nota de evolución' }).first()).toBeVisible();
  });

  test('agendar próxima cita desde la agenda', async ({ page }) => {
    await page.goto('/agenda');

    // Open "Nueva cita" sheet
    await page.getByRole('button', { name: 'Nueva cita' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Search for patient by cédula inside the dialog to avoid matching agenda cards
    await dialog.getByPlaceholder('Buscar por nombre o cédula…').fill(ANA_CEDULA);
    // Wait for the 300ms debounce + server action
    await expect(dialog.getByRole('button', { name: /Ana/ })).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole('button', { name: /Ana/ }).first().click();

    // Set date to tomorrow relative to the server-provided clinic date.
    const dateInput = dialog.locator('input[name="date"]');
    const tomorrow = addCalendarDays(await dateInput.inputValue(), 1);
    await dateInput.fill(tomorrow);
    await dialog.locator('#start_time').fill('10:00');

    // Submit; createAppointment calls redirect('/agenda') on success.
    await dialog.getByRole('button', { name: 'Guardar cita' }).click();
    await page.waitForURL('/agenda', { timeout: 10_000 });
  });
});
