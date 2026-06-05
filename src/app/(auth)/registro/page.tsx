import { redirect } from 'next/navigation';

// Self-service registration is disabled during the invite-only pilot. All
// acquisition is funneled through the landing page's "Solicitar acceso" form,
// which emails the operator. This route therefore redirects to the landing
// page; the `from=register` hint lets the landing surface the access-request
// form to anyone who arrives here from an old link.
//
// The underlying registration logic (server action, validators, DB code) is
// intentionally left in place — it will be re-enabled when self-service
// launches with Stripe. Only this route is made inaccessible.
export default function RegistroPage() {
  redirect('/?from=register');
}
