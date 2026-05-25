// Builds the Spanish subject/HTML/text content for the patient history
// email. Kept separate from the Resend transport so the copy can be tested
// without mocking the SDK.

export interface PatientHistoryEmailContent {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPatientHistoryEmail(params: {
  patientFirstName: string;
  patientLastName: string;
  clinicName: string;
}): PatientHistoryEmailContent {
  const fullName = `${params.patientFirstName} ${params.patientLastName}`.trim();
  const subject = `Historia clínica — ${fullName}`;

  const text = [
    `Estimado/a,`,
    ``,
    `Adjuntamos la historia clínica solicitada en formato PDF.`,
    ``,
    `Este documento contiene información médica confidencial. Si usted recibió este correo por error, por favor elimínelo y notifique al remitente.`,
    ``,
    `— ${params.clinicName}`,
  ].join('\n');

  const safeName = escapeHtml(fullName);
  const safeClinic = escapeHtml(params.clinicName);
  const html = `<!doctype html>
<html lang="es">
<body style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111; line-height:1.5;">
  <p>Estimado/a,</p>
  <p>Adjuntamos la historia clínica de <strong>${safeName}</strong> en formato PDF.</p>
  <p style="background:#fff8e1; border:1px solid #f5d27a; padding:12px; border-radius:6px; font-size: 13px;">
    Este documento contiene información médica confidencial. Si usted recibió este correo por error,
    por favor elimínelo y notifique al remitente.
  </p>
  <p style="margin-top:24px; color:#555;">— ${safeClinic}</p>
</body>
</html>`;

  return { subject, html, text };
}
