// Bilingual copy for the marketing landing page. Spanish is the default; the
// landing toggles between the two client-side without a reload. Kept as a
// single typed object so both languages stay structurally in lock-step.

export type Lang = 'es' | 'en';

export interface Feature {
  title: string;
  description: string;
}

export interface Step {
  title: string;
  description: string;
}

export interface LandingCopy {
  nav: { login: string; tryDemo: string };
  hero: {
    headline: string;
    subheadline: string;
    tryDemo: string;
    requestAccess: string;
    mockupCaption: string;
  };
  features: { heading: string; items: Feature[] };
  how: { heading: string; steps: Step[] };
  cta: {
    heading: string;
    demo: { title: string; body: string; button: string };
    access: {
      title: string;
      body: string;
      name: string;
      email: string;
      whatsapp: string;
      clinic: string;
      specialty: string;
      submit: string;
      submitting: string;
      success: string;
      whatsappButton: string;
      or: string;
    };
  };
  feedback: {
    heading: string;
    body: string;
    category: string;
    categoryBug: string;
    categorySuggestion: string;
    categoryGeneral: string;
    rating: string;
    message: string;
    email: string;
    emailPlaceholder: string;
    submit: string;
    submitting: string;
    success: string;
  };
  footer: {
    terms: string;
    privacy: string;
    dpa: string;
    operator: string;
  };
}

export const COPY: Record<Lang, LandingCopy> = {
  es: {
    nav: { login: 'Ingresar', tryDemo: 'Probar demo' },
    hero: {
      headline: 'Gestiona tu consultorio y tus pacientes desde cualquier lugar.',
      subheadline:
        'Historia clínica electrónica para médicos de consulta privada. Tus pacientes, tu agenda, tus notas — en cualquier dispositivo, en cualquier momento.',
      tryDemo: 'Probar demo',
      requestAccess: 'Solicitar acceso',
      mockupCaption: 'Tu consultorio, en una sola pantalla.',
    },
    features: {
      heading: 'Todo lo que tu consulta necesita',
      items: [
        {
          title: 'Historia clínica completa',
          description: 'Notas SOAP, antecedentes, documentos, imágenes, todo en un solo lugar.',
        },
        {
          title: 'Acceso desde cualquier dispositivo',
          description: 'Funciona en computadora, tablet y móvil. Sin instalar nada.',
        },
        {
          title: 'Seguro y privado',
          description: 'Tus pacientes son tuyos. Datos cifrados y separados por consultorio.',
        },
        {
          title: 'Diseñado para Latinoamérica',
          description: 'Construido para médicos de consulta privada en la región.',
        },
      ],
    },
    how: {
      heading: 'Cómo funciona',
      steps: [
        { title: 'Solicita acceso', description: 'Te contactamos para entender tu consultorio.' },
        { title: 'Configuramos tu cuenta', description: 'Te ayudamos a empezar.' },
        { title: 'Usas Hisamed', description: 'Atiende pacientes con todo a la mano.' },
      ],
    },
    cta: {
      heading: 'Pruébalo o solicita acceso',
      demo: {
        title: 'Probar demo',
        body: 'Explora una cuenta de demostración con datos de ejemplo. Es solo de lectura: puedes navegar libremente, los cambios no se guardan.',
        button: 'Entrar a la demo',
      },
      access: {
        title: 'Solicitar acceso',
        body: 'Déjanos tus datos y te contactamos para configurar tu consultorio.',
        name: 'Nombre',
        email: 'Correo',
        whatsapp: 'WhatsApp',
        clinic: 'Nombre del consultorio',
        specialty: 'Especialidad',
        submit: 'Enviar solicitud',
        submitting: 'Enviando…',
        success: '¡Gracias! Te contactaremos pronto.',
        whatsappButton: 'Prefiero WhatsApp',
        or: 'o',
      },
    },
    feedback: {
      heading: 'Comparte tu opinión',
      body: 'Cuéntanos qué te parece Hisamed. Tu comentario nos ayuda a mejorar.',
      category: 'Categoría',
      categoryBug: 'Error / Bug',
      categorySuggestion: 'Sugerencia / Funcionalidad',
      categoryGeneral: 'Comentario general',
      rating: '¿Cómo calificarías tu experiencia?',
      message: 'Mensaje',
      email: 'Correo (opcional)',
      emailPlaceholder: 'Para darte seguimiento',
      submit: 'Enviar comentario',
      submitting: 'Enviando…',
      success: '¡Gracias por tu comentario!',
    },
    footer: {
      terms: 'Términos',
      privacy: 'Privacidad',
      dpa: 'DPA',
      operator: 'Hisamed — operado por Angel Jaen.',
    },
  },
  en: {
    nav: { login: 'Sign in', tryDemo: 'Try the demo' },
    hero: {
      headline: 'Manage your practice and your patients from anywhere.',
      subheadline:
        'Electronic health records for private-practice physicians. Your patients, your schedule, your notes — on any device, anytime.',
      tryDemo: 'Try the demo',
      requestAccess: 'Request access',
      mockupCaption: 'Your practice, on a single screen.',
    },
    features: {
      heading: 'Everything your practice needs',
      items: [
        {
          title: 'Complete medical records',
          description: 'SOAP notes, history, documents, images — all in one place.',
        },
        {
          title: 'Access from any device',
          description: 'Works on desktop, tablet and mobile. Nothing to install.',
        },
        {
          title: 'Secure and private',
          description: 'Your patients are yours. Encrypted data, isolated per practice.',
        },
        {
          title: 'Built for Latin America',
          description: 'Made for private-practice physicians in the region.',
        },
      ],
    },
    how: {
      heading: 'How it works',
      steps: [
        { title: 'Request access', description: 'We reach out to understand your practice.' },
        { title: 'We set up your account', description: 'We help you get started.' },
        { title: 'You use Hisamed', description: 'See patients with everything at hand.' },
      ],
    },
    cta: {
      heading: 'Try it or request access',
      demo: {
        title: 'Try the demo',
        body: 'Explore a demo account with sample data. It is read-only: browse freely, changes are not saved.',
        button: 'Enter the demo',
      },
      access: {
        title: 'Request access',
        body: 'Leave us your details and we will reach out to set up your practice.',
        name: 'Name',
        email: 'Email',
        whatsapp: 'WhatsApp',
        clinic: 'Practice name',
        specialty: 'Specialty',
        submit: 'Send request',
        submitting: 'Sending…',
        success: 'Thank you! We will be in touch soon.',
        whatsappButton: 'I prefer WhatsApp',
        or: 'or',
      },
    },
    feedback: {
      heading: 'Share your feedback',
      body: 'Tell us what you think of Hisamed. Your feedback helps us improve.',
      category: 'Category',
      categoryBug: 'Error / Bug',
      categorySuggestion: 'Suggestion / Feature',
      categoryGeneral: 'General comment',
      rating: 'How would you rate your experience?',
      message: 'Message',
      email: 'Email (optional)',
      emailPlaceholder: 'So we can follow up',
      submit: 'Send feedback',
      submitting: 'Sending…',
      success: 'Thanks for your feedback!',
    },
    footer: {
      terms: 'Terms',
      privacy: 'Privacy',
      dpa: 'DPA',
      operator: 'Hisamed — operated by Angel Jaen.',
    },
  },
};

// WhatsApp deep link. Number is a public placeholder until configured via
// NEXT_PUBLIC_WHATSAPP_NUMBER (digits only, international format).
export function whatsappHref(lang: Lang): string {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '000000000000';
  const text =
    lang === 'es'
      ? 'Hola, me interesa probar Hisamed.'
      : 'Hi, I am interested in trying Hisamed.';
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
