import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { LogoutButton } from '@/components/logout-button';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { fullName: true, role: true, email: true },
  });

  if (!user) redirect('/login');

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">ClinicaMVP</span>
          <span className="text-xs text-muted-foreground">
            {user.fullName} · {user.role}
          </span>
        </div>
        <LogoutButton />
      </header>
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Próximamente: citas del día, pacientes en espera y contadores.
          </p>
        </div>
      </main>
    </div>
  );
}
