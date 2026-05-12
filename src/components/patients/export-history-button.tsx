import Link from 'next/link';
import { Download } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

interface ExportHistoryButtonProps {
  patientId: string;
}

// Plain link to the export route: the browser sees the application/pdf
// response with Content-Disposition: attachment and offers a save dialog.
// Render-time visibility is gated by the caller (admin/doctor only) — the
// route handler enforces the same rule server-side.
export function ExportHistoryButton({ patientId }: ExportHistoryButtonProps) {
  return (
    <Link
      href={`/api/patients/${patientId}/export-history`}
      // The endpoint returns Content-Disposition: attachment. `download`
      // makes the browser honor that without triggering client routing.
      download
      prefetch={false}
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      <Download className="h-3.5 w-3.5" />
      Exportar historial
    </Link>
  );
}
