> 📜 Historical pre-v2 technical spec. Records the original MVP data model and design intent. Current data model is in src/lib/db/schema.ts. Not maintained.

# PRD Técnico — ClinicaMVP

> Este documento es la especificación técnica del producto. No es para lectura casual —
> es referencia para el agente de código. Pásale la sección relevante cuando le pidas
> construir un módulo específico.

---

## 0. Resumen técnico

**Producto:** Historia Clínica Electrónica para consultorios de ginecología y medicina reproductiva.

**Stack:** Next.js 16.2 (App Router) · TypeScript strict · Drizzle ORM · PostgreSQL 16 · TailwindCSS v4 · shadcn/ui · Zod · JWT propio (argon2id)

**Multitenancy:** Toda tabla tiene `clinic_id`. Todo query filtra por `clinic_id`. Sin excepciones.

**Roles:** `admin` · `doctor` · `receptionist`

---

## 1. Modelo de datos completo

### Enums

```typescript
export const userRoleEnum = pgEnum('user_role', ['admin', 'doctor', 'receptionist']);

export const idTypeEnum = pgEnum('id_type', ['cedula', 'passport', 'other']);

export const sexEnum = pgEnum('sex', ['F', 'M', 'other']);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled', 'confirmed', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show'
]);

export const attachmentCategoryEnum = pgEnum('attachment_category', [
  'lab_result', 'imaging', 'consent', 'prescription', 'other'
]);

export const auditActionEnum = pgEnum('audit_action', [
  'CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT'
]);
```

### Tablas

#### clinics
| Columna | Tipo | Constraints |
|---|---|---|
| id | uuid | PK, default uuid_generate_v7 |
| name | varchar(255) | NOT NULL |
| address | text | |
| phone | varchar(50) | |
| timezone | varchar(50) | NOT NULL, default 'America/Caracas' |
| created_at | timestamp | NOT NULL, default now() |
| updated_at | timestamp | NOT NULL, default now() |

#### users
| Columna | Tipo | Constraints |
|---|---|---|
| id | uuid | PK |
| clinic_id | uuid | NOT NULL, FK → clinics |
| email | varchar(255) | NOT NULL, UNIQUE per clinic |
| password_hash | varchar(255) | NOT NULL |
| full_name | varchar(255) | NOT NULL |
| role | user_role | NOT NULL |
| is_active | boolean | NOT NULL, default true |
| created_at | timestamp | NOT NULL, default now() |
| updated_at | timestamp | NOT NULL, default now() |
| last_login_at | timestamp | |

**Índices:** `(clinic_id, email)` unique, `(clinic_id, is_active)`

#### patients
| Columna | Tipo | Constraints |
|---|---|---|
| id | uuid | PK |
| clinic_id | uuid | NOT NULL, FK → clinics |
| id_number | varchar(50) | NOT NULL |
| id_type | id_type | NOT NULL, default 'cedula' |
| first_name | varchar(255) | NOT NULL |
| last_name | varchar(255) | NOT NULL |
| date_of_birth | date | NOT NULL |
| sex | sex | NOT NULL |
| phone | varchar(50) | |
| email | varchar(255) | |
| address | text | |
| emergency_contact_name | varchar(255) | |
| emergency_contact_phone | varchar(50) | |
| insurance_info | text | |
| notes | text | |
| is_active | boolean | NOT NULL, default true |
| created_at | timestamp | NOT NULL, default now() |
| updated_at | timestamp | NOT NULL, default now() |
| created_by | uuid | NOT NULL, FK → users |

**Índices:** `(clinic_id, id_number)` unique, `(clinic_id, last_name, first_name)`, `(clinic_id, is_active)`

#### medical_histories (1:1 con patient)
| Columna | Tipo | Constraints |
|---|---|---|
| id | uuid | PK |
| patient_id | uuid | NOT NULL, FK → patients, UNIQUE |
| personal_history | text | |
| family_history | text | |
| surgical_history | text | |
| allergies | text | |
| current_medications | text | |
| habits | text | |
| specialty_data | jsonb | default '{}' |
| updated_at | timestamp | NOT NULL, default now() |
| updated_by | uuid | NOT NULL, FK → users |

**`specialty_data` schema para ginecología:**
```json
{
  "menarche_age": 12,
  "cycle_length_days": 28,
  "cycle_regularity": "regular | irregular | amenorrhea",
  "last_menstrual_period": "2026-03-15",
  "contraceptive_method": "none | oral | iud | implant | barrier | other",
  "pap_smear_last": "2025-08",
  "mammography_last": null,
  "gravida": 2,
  "para": 1,
  "cesarean": 0,
  "abortions": 1,
  "ectopic": 0,
  "living_children": 1,
  "obstetric_notes": ""
}
```

#### appointments
| Columna | Tipo | Constraints |
|---|---|---|
| id | uuid | PK |
| clinic_id | uuid | NOT NULL, FK → clinics |
| patient_id | uuid | NOT NULL, FK → patients |
| doctor_id | uuid | NOT NULL, FK → users |
| date | date | NOT NULL |
| start_time | time | NOT NULL |
| end_time | time | |
| status | appointment_status | NOT NULL, default 'scheduled' |
| reason | varchar(500) | |
| notes | text | |
| created_by | uuid | NOT NULL, FK → users |
| created_at | timestamp | NOT NULL, default now() |
| updated_at | timestamp | NOT NULL, default now() |
| cancelled_at | timestamp | |
| cancelled_by | uuid | FK → users |

**Índices:** `(clinic_id, doctor_id, date)`, `(clinic_id, patient_id)`, `(clinic_id, date, status)`

#### clinical_notes
| Columna | Tipo | Constraints |
|---|---|---|
| id | uuid | PK |
| patient_id | uuid | NOT NULL, FK → patients |
| appointment_id | uuid | FK → appointments |
| author_id | uuid | NOT NULL, FK → users |
| note_date | date | NOT NULL |
| chief_complaint | text | |
| subjective | text | |
| objective | text | |
| assessment | text | |
| plan | text | |
| diagnosis_text | varchar(500) | |
| diagnosis_code | varchar(20) | |
| internal_notes | text | |
| specialty_data | jsonb | default '{}' |
| is_signed | boolean | NOT NULL, default false |
| signed_at | timestamp | |
| created_at | timestamp | NOT NULL, default now() |
| updated_at | timestamp | NOT NULL, default now() |

**Regla de negocio:** Cuando `is_signed = true`, el registro es inmutable. Ni UPDATE ni DELETE. Las correcciones se hacen creando una nota nueva referenciando la original.

**Índices:** `(patient_id, note_date DESC)`, `(author_id)`

**`specialty_data` schema para consulta ginecológica:**
```json
{
  "blood_pressure": "120/80",
  "weight_kg": 65.5,
  "bmi": 24.2,
  "last_menstrual_period": "2026-03-15",
  "gestational_age_weeks": null,
  "ultrasound_findings": "",
  "follicle_count_left": null,
  "follicle_count_right": null,
  "endometrial_thickness_mm": null,
  "procedure_performed": "",
  "treatment_protocol": ""
}
```

#### attachments
| Columna | Tipo | Constraints |
|---|---|---|
| id | uuid | PK |
| patient_id | uuid | NOT NULL, FK → patients |
| clinical_note_id | uuid | FK → clinical_notes |
| uploaded_by | uuid | NOT NULL, FK → users |
| file_name | varchar(255) | NOT NULL |
| storage_key | varchar(500) | NOT NULL |
| file_type | varchar(100) | NOT NULL |
| file_size_bytes | integer | NOT NULL |
| category | attachment_category | default 'other' |
| description | varchar(500) | |
| uploaded_at | timestamp | NOT NULL, default now() |

**Regla:** `storage_key` es UUID + extensión (ej: `a1b2c3d4.pdf`). Nunca el nombre original del archivo. Archivos se sirven via Route Handler autenticado, nunca URL directa a storage.

**Índices:** `(patient_id)`, `(clinical_note_id)`

#### audit_logs
| Columna | Tipo | Constraints |
|---|---|---|
| id | uuid | PK |
| clinic_id | uuid | NOT NULL |
| user_id | uuid | NOT NULL |
| action | audit_action | NOT NULL |
| resource_type | varchar(50) | NOT NULL |
| resource_id | uuid | |
| details | jsonb | |
| ip_address | varchar(45) | |
| created_at | timestamp | NOT NULL, default now() |

**Regla:** Tabla append-only. Nunca UPDATE ni DELETE. Sin FK constraints (para no fallar si se borra un user). Sin `updated_at`.

---

## 2. Matriz de permisos

| Acción | admin | doctor | receptionist |
|---|---|---|---|
| Gestionar usuarios (CRUD) | ✅ | ❌ | ❌ |
| Ver audit log | ✅ | ❌ | ❌ |
| Configurar clínica | ✅ | ❌ | ❌ |
| Crear paciente | ✅ | ✅ | ✅ |
| Editar datos demográficos paciente | ✅ | ✅ | ✅ |
| Ver lista de pacientes | ✅ | ✅ | ✅ |
| Buscar pacientes | ✅ | ✅ | ✅ |
| Ver/editar historia clínica (antecedentes) | ✅ | ✅ | ❌ |
| Crear nota de evolución | ❌ | ✅ | ❌ |
| Editar nota propia (no firmada) | ❌ | ✅ | ❌ |
| Firmar nota | ❌ | ✅ | ❌ |
| Ver notas de evolución | ✅ | ✅ | ❌ |
| Ver `internal_notes` de nota clínica | ❌ | ✅ | ❌ |
| Gestionar citas (CRUD) | ✅ | ✅ | ✅ |
| Marcar asistencia | ✅ | ✅ | ✅ |
| Subir adjuntos | ✅ | ✅ | ✅ |
| Ver/descargar adjuntos | ✅ | ✅ | ✅ |
| Eliminar adjuntos | ✅ | ✅ (propios) | ❌ |
| Ver dashboard/contadores | ✅ | ✅ | ✅ |
| Importar pacientes CSV | ✅ | ❌ | ❌ |
| Exportar lista pacientes | ✅ | ❌ | ❌ |

---

## 3. Rutas de la aplicación

### Páginas públicas (grupo `(auth)`)
| Ruta | Página | Notas |
|---|---|---|
| `/login` | Login | Email + contraseña |
| `/forgot-password` | Recuperar contraseña | Post-MVP |

### Páginas autenticadas (grupo `(dashboard)`)
| Ruta | Página | Roles |
|---|---|---|
| `/` | Dashboard | Todos. Contadores: citas hoy, pacientes total, consultas del mes. |
| `/patients` | Lista de pacientes | Todos. Búsqueda por nombre, cédula, teléfono. Paginada. |
| `/patients/new` | Registrar paciente | Todos. |
| `/patients/[id]` | Ficha del paciente | Todos (receptionist ve datos demográficos + citas, no historia clínica). |
| `/patients/[id]/history` | Historia clínica (antecedentes) | admin, doctor. |
| `/patients/[id]/notes` | Notas de evolución (listado) | admin, doctor. |
| `/patients/[id]/notes/new` | Nueva nota de evolución | doctor. |
| `/patients/[id]/notes/[noteId]` | Ver/editar nota | doctor (editar solo si no firmada y es autor). admin solo lectura. |
| `/patients/[id]/attachments` | Adjuntos del paciente | Todos. |
| `/appointments` | Agenda | Todos. Vista diaria y semanal. Filtro por médico. |
| `/appointments/new` | Nueva cita | Todos. |
| `/settings` | Configuración | admin. Datos clínica, horarios. |
| `/settings/users` | Gestión de usuarios | admin. |
| `/settings/audit` | Log de auditoría | admin. Filtrable por fecha, usuario, acción. |
| `/settings/import` | Importar pacientes CSV | admin. |

### API Routes (Route Handlers)
| Ruta | Método | Propósito |
|---|---|---|
| `/api/auth/login` | POST | Login. Retorna access + refresh token. |
| `/api/auth/refresh` | POST | Renovar access token con refresh token. |
| `/api/auth/logout` | POST | Invalidar refresh token. |
| `/api/attachments/[id]/download` | GET | Descargar adjunto. Verifica auth + permisos + clinic_id. Genera URL temporal o stream. |
| `/api/attachments/upload` | POST | Subir adjunto. Multipart form data. Valida tipo de archivo y tamaño. |
| `/api/patients/import` | POST | Importar CSV de pacientes. Solo admin. |
| `/api/patients/export` | GET | Exportar lista de pacientes a CSV. Solo admin. |

Todas las demás mutaciones usan **Server Actions**, no API routes.

---

## 4. Server Actions por módulo

### Auth
| Action | Input | Lógica |
|---|---|---|
| `loginAction` | `{ email, password }` | Verificar credenciales con argon2id. Generar JWT (15min) + refresh (7d). Registrar audit LOGIN. |
| `logoutAction` | — | Invalidar refresh token. Limpiar cookies. Audit LOGOUT. |

### Patients
| Action | Input | Lógica |
|---|---|---|
| `createPatient` | Zod schema PatientCreate | Verificar permisos. Verificar unicidad `(clinic_id, id_number)`. Crear patient + medical_history vacía. Audit CREATE. |
| `updatePatient` | Zod schema PatientUpdate | Verificar permisos + clinic_id. Solo datos demográficos si receptionist. Audit UPDATE. |
| `togglePatientActive` | `{ patientId }` | Solo admin. Soft delete. Audit UPDATE. |

### Medical History
| Action | Input | Lógica |
|---|---|---|
| `updateMedicalHistory` | Zod schema MedicalHistoryUpdate | Solo admin/doctor. Verificar clinic_id via patient. Merge specialty_data (no reemplazar completo). Audit UPDATE. |

### Appointments
| Action | Input | Lógica |
|---|---|---|
| `createAppointment` | Zod schema AppointmentCreate | Verificar permisos. Verificar que no haya solapamiento (mismo doctor, misma hora). Audit CREATE. |
| `updateAppointmentStatus` | `{ appointmentId, status }` | Transiciones válidas: scheduled→confirmed→waiting→in_progress→completed. Cualquier estado→cancelled/no_show. Audit UPDATE. |
| `cancelAppointment` | `{ appointmentId, reason? }` | Setear status=cancelled, cancelled_at, cancelled_by. Audit UPDATE. |
| `rescheduleAppointment` | `{ appointmentId, newDate, newStartTime }` | Cancelar la actual + crear nueva. Audit UPDATE + CREATE. |

### Clinical Notes
| Action | Input | Lógica |
|---|---|---|
| `createClinicalNote` | Zod schema ClinicalNoteCreate | Solo doctor. Asociar a appointment si viene. Audit CREATE. |
| `updateClinicalNote` | Zod schema ClinicalNoteUpdate | Solo doctor + autor + no firmada. Audit UPDATE. |
| `signClinicalNote` | `{ noteId }` | Solo doctor + autor. Setear is_signed=true, signed_at=now(). Audit UPDATE. IRREVERSIBLE. |

### Attachments
| Action | Input | Lógica |
|---|---|---|
| `deleteAttachment` | `{ attachmentId }` | Admin o doctor que subió. Borrar de storage + DB. Audit DELETE. |

### Users (admin only)
| Action | Input | Lógica |
|---|---|---|
| `createUser` | Zod schema UserCreate | Solo admin. Hash password con argon2id. Audit CREATE. |
| `updateUser` | Zod schema UserUpdate | Solo admin. No puede desactivarse a sí mismo. Audit UPDATE. |
| `resetUserPassword` | `{ userId, newPassword }` | Solo admin. Audit UPDATE. |

---

## 5. Componentes principales

### Layout
- `DashboardLayout`: Sidebar con navegación (Pacientes, Agenda, Configuración). Header con nombre del usuario y logout. Responsive: sidebar colapsable en mobile.
- `AuthLayout`: Layout simple centrado para login.

### Pacientes
- `PatientSearchBar`: Input de búsqueda con debounce 300ms. Busca por nombre, cédula, teléfono.
- `PatientList`: Tabla paginada (20 por página). Columnas: nombre, cédula, teléfono, última cita, acciones.
- `PatientForm`: Formulario de registro/edición. Tabs: Datos personales | Contacto | Seguro.
- `PatientSummary`: Vista resumen en ficha. Card con datos clave + última cita + última nota.
- `MedicalHistoryForm`: Formulario de antecedentes. Secciones: Personales | Familiares | Quirúrgicos | Alergias | Medicación | Ginecológicos (specialty_data renderizado según schema).

### Agenda
- `AppointmentCalendar`: Vista diaria (default) y semanal. Columnas por hora (8:00-18:00 configurable). Click en slot para crear cita.
- `AppointmentCard`: Card dentro del calendario. Muestra: hora, nombre paciente, motivo, estado (con color).
- `AppointmentForm`: Modal/drawer para crear/editar cita. Selector de paciente (search), fecha, hora, médico, motivo.
- `TodayQueue`: Lista de pacientes del día con estados. Botón para marcar llegada/asistencia.

### Notas clínicas
- `ClinicalNoteForm`: Formulario SOAP. 4 textareas (Subjetivo, Objetivo, Análisis, Plan) + campos de diagnóstico + specialty_data dinámico + internal_notes. Botón "Guardar borrador" y "Firmar nota" (con confirmación).
- `ClinicalNoteTimeline`: Lista cronológica de notas del paciente. Fecha, diagnóstico, autor. Click para expandir.
- `ClinicalNoteView`: Vista de lectura de una nota firmada. No editable.

### Adjuntos
- `AttachmentUploader`: Drag & drop + file picker. Acepta PDF, JPG, PNG. Máximo 10MB. Muestra progreso.
- `AttachmentList`: Grid de adjuntos con thumbnail/icono, nombre, fecha, categoría. Botón descargar.

### Dashboard
- `StatsCards`: 4 cards con contadores: Citas hoy, Pacientes en espera, Consultas del mes, Pacientes totales.
- `TodayAppointments`: Mini-lista de las próximas citas del día.

### Configuración
- `UserManagement`: Tabla de usuarios con acciones (editar, desactivar). Botón crear usuario.
- `AuditLogViewer`: Tabla con filtros (fecha desde/hasta, usuario, acción, recurso). Paginada. Solo lectura.
- `ClinicSettings`: Formulario con nombre, dirección, teléfono, timezone, horarios de atención.
- `CsvImporter`: Upload de CSV, preview de datos, mapeo de columnas, confirmación, resumen de resultados.

---

## 6. Validaciones Zod

Las validaciones se definen en `src/lib/validators/` y se comparten entre Server Actions y formularios del frontend.

```typescript
// src/lib/validators/patient.ts
export const patientCreateSchema = z.object({
  id_number: z.string().min(3).max(50),
  id_type: z.enum(['cedula', 'passport', 'other']),
  first_name: z.string().min(1).max(255).trim(),
  last_name: z.string().min(1).max(255).trim(),
  date_of_birth: z.coerce.date().max(new Date(), 'Fecha de nacimiento no puede ser futura'),
  sex: z.enum(['F', 'M', 'other']),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(1000).optional(),
  emergency_contact_name: z.string().max(255).optional(),
  emergency_contact_phone: z.string().max(50).optional(),
  insurance_info: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

// src/lib/validators/appointment.ts
export const appointmentCreateSchema = z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  date: z.coerce.date(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

// src/lib/validators/clinical-note.ts
export const clinicalNoteCreateSchema = z.object({
  patient_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  note_date: z.coerce.date(),
  chief_complaint: z.string().max(1000).optional(),
  subjective: z.string().max(5000).optional(),
  objective: z.string().max(5000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
  diagnosis_text: z.string().max(500).optional(),
  diagnosis_code: z.string().max(20).optional(),
  internal_notes: z.string().max(5000).optional(),
  specialty_data: z.record(z.unknown()).optional(),
});

// src/lib/validators/user.ts
export const userCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10, 'Mínimo 10 caracteres'),
  full_name: z.string().min(1).max(255).trim(),
  role: z.enum(['admin', 'doctor', 'receptionist']),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
```

---

## 7. Auth y seguridad — implementación

### Flujo de autenticación
1. `POST /api/auth/login` → Verificar email+password → Generar access token (JWT, 15min) + refresh token (JWT, 7d).
2. Tokens se almacenan en cookies HttpOnly, Secure, SameSite=Lax.
3. Middleware de Next.js verifica presencia del access token. Si no hay, redirige a `/login`. **No verifica permisos**.
4. Cada Server Action y Route Handler llama a `getSession()` que decodifica el JWT y retorna `{ userId, clinicId, role }`.
5. Cada Server Action verifica `role` antes de ejecutar.
6. Cuando el access token expira, el frontend intercepta el 401 y llama a `/api/auth/refresh`.

### Helper de sesión
```typescript
// src/lib/auth/session.ts
export async function getSession(): Promise<Session | null> {
  const token = cookies().get('access_token')?.value;
  if (!token) return null;
  try {
    const payload = await jwtVerify(token, secret);
    return {
      userId: payload.sub,
      clinicId: payload.clinicId,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error('No autenticado');
  return session;
}

export async function requireRole(allowedRoles: Role[]): Promise<Session> {
  const session = await requireSession();
  if (!allowedRoles.includes(session.role)) throw new Error('Sin permisos');
  return session;
}
```

### Helper de auditoría
```typescript
// src/lib/audit.ts
export async function auditLog(params: {
  clinicId: string;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await db.insert(auditLogs).values({
    id: generateId(),
    ...params,
  });
}
```

---

## 8. Storage de adjuntos

- Proveedor: Cloudflare R2 (compatible S3).
- SDK: `@aws-sdk/client-s3` con endpoint de R2.
- Upload: Route Handler `POST /api/attachments/upload` recibe multipart, valida tipo (PDF, JPG, PNG) y tamaño (max 10MB), genera UUID como storage key, sube a R2, crea registro en DB.
- Download: Route Handler `GET /api/attachments/[id]/download` verifica auth + clinic_id, genera presigned URL (5min TTL) o hace streaming.
- Nunca exponer URL directa del bucket.

---

## 9. Orden de construcción de módulos

Este es el orden en que se deben construir los módulos. Cada uno depende del anterior.

| # | Módulo | Depende de | Semana estimada |
|---|---|---|---|
| 1 | Setup proyecto + DB schema + Docker | — | 1 |
| 2 | Auth (login, logout, JWT, middleware) | Setup | 1 |
| 3 | Layout dashboard + navegación | Auth | 1 |
| 4 | Pacientes (CRUD + búsqueda) | Layout | 2 |
| 5 | Historia clínica (antecedentes + specialty_data ginecología) | Pacientes | 2 |
| 6 | Agenda (citas CRUD + vista diaria/semanal + estados) | Pacientes | 3 |
| 7 | Notas de evolución (CRUD + SOAP + firma + timeline) | Pacientes + Agenda | 3-4 |
| 8 | Adjuntos (upload/download + storage R2) | Pacientes + Notas | 4 |
| 9 | Auditoría (log viewer + filtros) | Auth | 4 |
| 10 | Dashboard (contadores + citas del día) | Todo lo anterior | 5 |
| 11 | Configuración (clínica + usuarios + import CSV) | Auth | 5 |
| 12 | Permisos finales + hardening de seguridad | Todo | 6 |
| 13 | Testing e2e del flujo completo | Todo | 6 |

---

## 10. Seed data para desarrollo

El seed debe crear:
- 1 clínica: "Clínica Fertility Plus"
- 3 usuarios: 1 admin, 1 doctor (Dra. María García), 1 receptionist (Carmen López)
- 20 pacientes con datos realistas (nombres venezolanos, cédulas V-xxxxx)
- 5 pacientes con medical_history completa (incluido specialty_data de ginecología)
- 30 appointments distribuidos en la semana actual (varios estados)
- 10 clinical_notes para los 5 pacientes principales (algunas firmadas, algunas en borrador)
- Password de todos los usuarios en dev: `clinicamvp2026`

---

*Fin del PRD Técnico. Para contexto de negocio, personas y decisiones estratégicas, ver `docs/PRODUCT.md`.*
