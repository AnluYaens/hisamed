# Prompts de Construcción — ClinicaMVP

> **Instrucciones para el equipo:**
> 1. Pegar UN prompt a la vez en Claude Code / Cursor / Codex.
> 2. No pegar el siguiente hasta que el actual compile y funcione.
> 3. El orden importa: cada módulo depende del anterior.
> 4. Cuando el prompt dice "lee docs/PRD-TECNICO.md sección X", el agente
>    debe leer esa sección del archivo para obtener el schema/specs exactas.
> 5. Después de cada módulo, hacer commit.

---

## Módulo 1 — Setup del proyecto

```
Lee CLAUDE.md para entender la arquitectura del proyecto.

Inicializa el proyecto ClinicaMVP:

1. Crea un proyecto Next.js 16 con TypeScript, TailwindCSS v4, App Router, src directory.
   Usa pnpm como package manager.

2. Instala las dependencias:
   - drizzle-orm, pg, @types/pg (dev), drizzle-kit (dev)
   - jose (para JWT)
   - argon2 (hash de contraseñas)
   - zod
   - uuid, @types/uuid (dev)

3. Inicializa shadcn/ui con el theme por defecto.

4. Crea la estructura de carpetas exacta definida en CLAUDE.md.

5. Crea docker-compose.yml con PostgreSQL 16 alpine en puerto 5432,
   volumen persistente, usuario: clinica, password: clinica_dev, database: clinica_mvp.

6. Crea .env.example y .env con las variables que indica CLAUDE.md.

7. Crea drizzle.config.ts apuntando a src/lib/db/schema.ts.

8. Lee docs/PRD-TECNICO.md sección 1 completa.
   Crea src/lib/db/schema.ts con TODAS las tablas, enums, relaciones e índices
   exactamente como están especificadas ahí.

9. Crea src/lib/db/index.ts con la conexión a PostgreSQL.

10. Agrega los scripts en package.json: dev (con turbopack), build, start,
    db:generate, db:migrate, db:studio, test, test:e2e.

11. Levanta Docker, genera las migraciones, aplícalas, verifica que las tablas existen.

12. Crea un seed básico (src/lib/db/seed.ts) según docs/PRD-TECNICO.md sección 10.
    Agrega script "db:seed" en package.json.

Verifica que `pnpm dev` compila sin errores.
```

---

## Módulo 2 — Autenticación

```
Lee CLAUDE.md y docs/PRD-TECNICO.md sección 7 (Auth y seguridad).

Implementa el sistema de autenticación:

1. Crea src/lib/auth/session.ts con los helpers getSession(), requireSession()
   y requireRole() exactamente como están en el PRD sección 7.

2. Crea src/lib/auth/password.ts con hashPassword() y verifyPassword()
   usando argon2id.

3. Crea src/lib/auth/tokens.ts con generateAccessToken(), generateRefreshToken()
   y verifyToken() usando jose.
   - Access token: 15 minutos, incluye { sub: userId, clinicId, role }.
   - Refresh token: 7 días.

4. Crea el Route Handler POST /api/auth/login:
   - Valida input con loginSchema (docs/PRD-TECNICO.md sección 6).
   - Verifica email + password contra la DB (filtrar por clinic — por ahora asumir
     una sola clínica, buscar user por email).
   - Verifica que el usuario esté activo.
   - Genera access + refresh token.
   - Setea cookies HttpOnly, Secure (solo en prod), SameSite=Lax.
   - Registra audit log LOGIN.
   - Rate limiting: máximo 5 intentos fallidos por IP en 15 minutos
     (implementar con Map en memoria por ahora, no Redis).

5. Crea POST /api/auth/refresh: renueva access token usando refresh token.

6. Crea POST /api/auth/logout: limpia cookies, audit log LOGOUT.

7. Crea src/middleware.ts:
   - SOLO redirección. Si no hay access_token cookie y la ruta no es /login,
     redirigir a /login.
   - NO poner lógica de permisos aquí.

8. Crea src/lib/audit.ts con el helper auditLog() del PRD sección 7.

9. Crea la página /login con formulario (email + contraseña),
   manejo de errores, y redirect al dashboard después del login.

Verifica: puedes hacer login con los usuarios del seed y llegas al dashboard (vacío por ahora).
Verifica: sin login, /login se muestra. Cualquier otra ruta redirige a /login.
```

---

## Módulo 3 — Layout del dashboard

```
Lee CLAUDE.md para convenciones de componentes.

Construye el layout principal de la aplicación autenticada:

1. Crea src/app/(dashboard)/layout.tsx:
   - Sidebar izquierdo con navegación: Inicio, Pacientes, Agenda, Configuración.
   - Usa iconos de lucide-react.
   - Header superior con: nombre del usuario logueado, rol, botón de logout.
   - El sidebar es colapsable en móvil (hamburger menu).
   - Responsive: en desktop sidebar fijo, en tablet/mobile overlay.

2. Crea src/app/(auth)/layout.tsx:
   - Layout centrado, limpio, solo para la página de login.

3. Crea src/app/(dashboard)/page.tsx:
   - Página de dashboard placeholder. Título "Dashboard" y texto
     "Bienvenido a ClinicaMVP". Después la llenaremos con contadores.

4. Usa shadcn/ui para los componentes de UI (Button, Sheet para sidebar mobile,
   DropdownMenu para el menú del usuario).

5. El active state del sidebar debe reflejar la ruta actual.

6. El diseño debe ser limpio, profesional, colores neutros con un accent azul médico.

Verifica: después del login, ves el dashboard con sidebar funcional.
Los links de navegación funcionan (llevan a páginas vacías por ahora).
El sidebar se colapsa correctamente en móvil.
Logout funciona y redirige a /login.
```

---

## Módulo 4 — Pacientes (CRUD + búsqueda)

```
Lee docs/PRD-TECNICO.md secciones 1 (tabla patients), 2 (permisos),
3 (rutas de pacientes), 4 (server actions de patients) y 6 (validación patientCreateSchema).

Implementa el módulo de pacientes:

1. Crea los schemas de validación en src/lib/validators/patient.ts
   según PRD sección 6.

2. Crea las queries en src/queries/patients.ts:
   - getPatients(clinicId, { search?, page?, limit? }): lista paginada con búsqueda.
     La búsqueda debe buscar por first_name, last_name, id_number y phone.
     Usar ILIKE para búsqueda parcial. Paginar con limit/offset (20 por página).
   - getPatientById(clinicId, patientId): datos completos del paciente.
   - checkDuplicateIdNumber(clinicId, idNumber): verificar unicidad.

3. Crea las Server Actions en src/actions/patients.ts:
   - createPatient: según PRD sección 4. Verifica permisos (todos pueden crear).
     Crea patient + medical_history vacía en una transacción.
   - updatePatient: según PRD sección 4. Receptionist solo puede editar
     datos demográficos (no clinical data).
   - togglePatientActive: solo admin.
   Todas registran audit log.

4. Crea las páginas:
   - /patients: Lista de pacientes con PatientSearchBar + PatientList.
     Búsqueda con debounce 300ms. Paginación. Botón "Nuevo paciente".
   - /patients/new: Formulario de registro con PatientForm.
     Al guardar, redirigir a la ficha del paciente.
   - /patients/[id]: Ficha del paciente con PatientSummary.
     Tabs o secciones: Datos personales, Citas (placeholder), Historia clínica (placeholder),
     Notas (placeholder), Adjuntos (placeholder).
     Botón editar datos.

5. Componentes:
   - PatientSearchBar: Input con icono de búsqueda, debounce, lupa.
   - PatientList: Tabla con columnas nombre, cédula, teléfono, edad, última cita (vacío por ahora).
     Cada fila es clickeable y lleva a /patients/[id].
   - PatientForm: Formulario con secciones. Validación client-side con Zod.
     useActionState para manejar el submit con Server Action.
   - PatientSummary: Cards con datos clave del paciente.

Verifica: puedes crear un paciente, verlo en la lista, buscarlo, abrir su ficha, editar sus datos.
Verifica: la búsqueda funciona por nombre parcial y por cédula.
Verifica: los permisos se verifican en el servidor (no solo en el UI).
```

---

## Módulo 5 — Historia clínica (antecedentes)

```
Lee docs/PRD-TECNICO.md sección 1 (tabla medical_histories con specialty_data schema
de ginecología), sección 2 (permisos) y sección 4 (server actions).

Implementa el módulo de historia clínica / antecedentes:

1. Crea src/lib/validators/medical-history.ts con schema de validación.
   Incluir validación del specialty_data de ginecología como un sub-objeto
   con campos tipados (no z.record genérico).

2. Crea queries en src/queries/medical-history.ts:
   - getMedicalHistory(clinicId, patientId): retorna la historia clínica con specialty_data.

3. Crea Server Action updateMedicalHistory en src/actions/medical-history.ts:
   - Solo admin y doctor (receptionist NO puede).
   - Verificar que el paciente pertenece al clinic_id.
   - Merge de specialty_data: no reemplazar todo el JSON, hacer merge a nivel
     de campos del primer nivel.
   - Audit log UPDATE.

4. Crea la página /patients/[id]/history:
   - MedicalHistoryForm con secciones colapsables:
     a) Antecedentes personales (textarea)
     b) Antecedentes familiares (textarea)
     c) Antecedentes quirúrgicos (textarea)
     d) Alergias (textarea)
     e) Medicación actual (textarea)
     f) Hábitos (textarea)
     g) Antecedentes ginecológicos (formulario estructurado):
        - Menarquía (número)
        - Duración del ciclo (número)
        - Regularidad (select: regular/irregular/amenorrea)
        - FUM — Fecha última menstruación (date picker)
        - Método anticonceptivo (select)
        - Último Papanicolaou (month picker)
        - Última mamografía (month picker)
        - Fórmula obstétrica: G_P_C_A_E_ (inputs numéricos inline)
        - Hijos vivos (número)
        - Notas obstétricas (textarea)
   - Botón guardar con feedback de éxito.
   - Si el usuario es receptionist, no puede ver esta página (redirect).

5. En la ficha del paciente (/patients/[id]), activar el tab/link de
   "Historia clínica" para que lleve a esta página.

Verifica: puedes llenar los antecedentes de un paciente, guardar, y al recargar
la página los datos persisten.
Verifica: los datos de ginecología se guardan correctamente en specialty_data JSONB.
Verifica: un receptionist NO puede acceder a esta página.
```

---

## Módulo 6 — Agenda y citas

```
Lee docs/PRD-TECNICO.md secciones 1 (tabla appointments), 2 (permisos),
3 (rutas), 4 (server actions de appointments) y 6 (appointmentCreateSchema).

Implementa el módulo de agenda / citas:

1. Crea src/lib/validators/appointment.ts según PRD sección 6.

2. Crea queries en src/queries/appointments.ts:
   - getAppointmentsByDate(clinicId, date, doctorId?): citas de un día,
     con datos del paciente (join). Ordenadas por start_time.
   - getAppointmentsByWeek(clinicId, weekStartDate, doctorId?): citas de una semana.
   - getAppointmentsByPatient(clinicId, patientId): historial de citas de un paciente.
   - checkOverlap(clinicId, doctorId, date, startTime, endTime?): verificar solapamiento.

3. Crea Server Actions en src/actions/appointments.ts:
   - createAppointment: verificar solapamiento antes de crear.
   - updateAppointmentStatus: con transiciones válidas según PRD sección 4.
   - cancelAppointment: con motivo opcional.
   Todas verifican permisos y registran audit log.

4. Crea las páginas:
   - /appointments: Vista principal de agenda.
     - Toggle vista diaria / semanal.
     - Filtro por médico (si hay más de uno).
     - Vista diaria: lista cronológica de citas con cards por cada cita.
       Cada card muestra: hora, nombre del paciente (clickeable → ficha),
       motivo, estado con badge de color.
     - Vista semanal: grid con días como columnas y horas como filas.
     - Botón "Nueva cita" que abre modal/drawer.
   - /appointments/new: (o modal en /appointments)
     - Selector de paciente con búsqueda (reusar PatientSearchBar).
     - Date picker para fecha.
     - Time picker para hora inicio.
     - Select de médico.
     - Campo de motivo.
     - Botón guardar.

5. Componentes:
   - AppointmentCard: card de cita con acciones contextuales
     (marcar llegada, marcar atendida, cancelar).
   - TodayQueue: componente reutilizable que muestra la cola del día.
     Se usa tanto en /appointments como en el dashboard (módulo 10).
   - Badges de estado con colores:
     scheduled=gris, confirmed=azul, waiting=amarillo,
     in_progress=naranja, completed=verde, cancelled=rojo, no_show=rojo oscuro.

6. En la ficha del paciente (/patients/[id]), activar la sección de citas
   mostrando las citas del paciente (pasadas y futuras).

Verifica: puedes crear una cita, verla en la agenda diaria y semanal.
Verifica: puedes cambiar estados (marcar llegada, marcar atendida, cancelar).
Verifica: no se pueden crear citas solapadas para el mismo médico.
Verifica: las citas aparecen en la ficha del paciente.
```

---

## Módulo 7 — Notas de evolución

```
Lee docs/PRD-TECNICO.md secciones 1 (tabla clinical_notes con specialty_data),
2 (permisos — IMPORTANTE: solo doctor puede crear/editar notas),
3 (rutas), 4 (server actions) y 6 (clinicalNoteCreateSchema).

Implementa el módulo de notas de evolución / consultas:

1. Crea src/lib/validators/clinical-note.ts según PRD sección 6.

2. Crea queries en src/queries/clinical-notes.ts:
   - getClinicalNotesByPatient(clinicId, patientId): lista cronológica DESC.
     Incluir nombre del autor.
   - getClinicalNoteById(clinicId, noteId): nota completa con datos del paciente y autor.

3. Crea Server Actions en src/actions/clinical-notes.ts:
   - createClinicalNote: SOLO doctor. Asociar a appointment si viene.
   - updateClinicalNote: SOLO doctor + SOLO autor + SOLO si no firmada.
     Si is_signed=true, rechazar con error claro.
   - signClinicalNote: SOLO doctor + SOLO autor. Setear is_signed=true,
     signed_at=now(). IRREVERSIBLE. Mostrar confirmación en el frontend.
   Todas registran audit log.

4. Crea las páginas:
   - /patients/[id]/notes: Lista cronológica de notas (ClinicalNoteTimeline).
     Cada item muestra: fecha, diagnóstico, autor, estado (borrador/firmada).
     Click para ver/editar.
   - /patients/[id]/notes/new: ClinicalNoteForm.
     - Formato SOAP: 4 textareas grandes (Subjetivo, Objetivo, Análisis, Plan).
     - Campos de diagnóstico (texto libre + CIE-10 opcional).
     - internal_notes: textarea separada con aviso visual
       "Solo visible para médicos".
     - specialty_data de consulta ginecológica:
       TA, peso, IMC (calculado automático), FUM, hallazgos ecográficos,
       conteo folicular (izq/der), grosor endometrial, procedimiento realizado.
     - Botón "Guardar borrador" (guarda sin firmar).
     - Botón "Firmar nota" con diálogo de confirmación:
       "Una vez firmada, la nota no se puede editar. ¿Confirmar?"
   - /patients/[id]/notes/[noteId]:
     - Si la nota es del doctor actual y no está firmada: modo edición.
     - Si está firmada o es de otro doctor: modo lectura (ClinicalNoteView).
     - Admin: siempre modo lectura.

5. Flujo de firma:
   - La nota se crea como borrador (is_signed=false).
   - El doctor puede editarla varias veces.
   - Al firmar, se vuelve inmutable.
   - En la lista, mostrar badge "Borrador" o "Firmada" con icono.

6. En la ficha del paciente, activar el tab de notas.
   Agregar botón "Nueva nota" si el usuario es doctor.

7. SEGURIDAD CRÍTICA: el campo internal_notes NUNCA se debe enviar al frontend
   si el usuario es receptionist. Filtrarlo en las queries,
   no solo ocultarlo con CSS.

Verifica: un doctor puede crear, editar y firmar una nota.
Verifica: una nota firmada NO se puede editar (ni desde el UI ni manipulando requests).
Verifica: un receptionist NO puede ver notas.
Verifica: internal_notes no aparece en el response para receptionist.
Verifica: el campo de specialty_data se guarda correctamente.
```

---

## Módulo 8 — Adjuntos

```
Lee docs/PRD-TECNICO.md secciones 1 (tabla attachments), 2 (permisos),
3 (API routes de attachments) y 8 (storage).

Implementa el módulo de adjuntos:

1. Crea src/lib/storage.ts:
   - Configurar @aws-sdk/client-s3 con credenciales de Cloudflare R2 desde env vars.
   - uploadFile(buffer, key, contentType): sube a R2.
   - getPresignedUrl(key, expiresIn=300): genera URL temporal para descarga.
   - deleteFile(key): elimina de R2.
   - Para desarrollo sin R2: crear una implementación local que guarde en
     /tmp/clinica-attachments/ y sirva desde ahí. Usar una variable de entorno
     STORAGE_PROVIDER=local|r2 para elegir.

2. Instala @aws-sdk/client-s3 y @aws-sdk/s3-request-presigner.

3. Crea Route Handler POST /api/attachments/upload:
   - Autenticación requerida.
   - Acepta multipart/form-data con campos: file, patient_id, clinical_note_id?, category?, description?.
   - Validar tipo de archivo: solo PDF, JPG, JPEG, PNG. Rechazar todo lo demás.
   - Validar tamaño: máximo 10MB.
   - Generar storage_key como UUID + extensión original.
   - Subir a storage.
   - Crear registro en tabla attachments.
   - Audit log CREATE.
   - Retornar el attachment creado.

4. Crea Route Handler GET /api/attachments/[id]/download:
   - Autenticación requerida.
   - Verificar que el attachment pertenece a un paciente del clinic_id del usuario.
   - Generar presigned URL (5 min) y redirect, o hacer streaming directo.
   - Audit log READ.

5. Crea Server Action deleteAttachment en src/actions/attachments.ts:
   - Admin o el doctor que subió el archivo.
   - Eliminar de storage + DB.
   - Audit log DELETE.

6. Crea componentes:
   - AttachmentUploader: zona de drag & drop + botón de selección.
     Muestra preview del archivo seleccionado antes de subir.
     Barra de progreso durante upload.
     Campos para categoría (lab_result, imaging, consent, prescription, other)
     y descripción.
   - AttachmentList: grid de adjuntos. Cada item muestra: icono según tipo
     (PDF/imagen), nombre original, categoría con badge, fecha, botón descargar,
     botón eliminar (si tiene permisos).

7. Integrar en la ficha del paciente (/patients/[id]):
   - Tab/sección de adjuntos con AttachmentUploader + AttachmentList.
   - También se puede adjuntar archivos desde la nota de evolución
     (clinical_note_id asociado).

Verifica: puedes subir un PDF y una imagen, verlos en la lista, descargarlos.
Verifica: archivos de tipo no permitido son rechazados.
Verifica: archivos mayores a 10MB son rechazados.
Verifica: la URL de descarga no es directa al bucket (pasa por el Route Handler).
Verifica: un receptionist NO puede eliminar adjuntos.
```

---

## Módulo 9 — Auditoría

```
Lee docs/PRD-TECNICO.md secciones 1 (tabla audit_logs) y 2 (solo admin puede ver).

Implementa el visor de auditoría:

1. Crea queries en src/queries/audit-logs.ts:
   - getAuditLogs(clinicId, filters: { dateFrom?, dateTo?, userId?, action?,
     resourceType? }, page, limit): lista paginada con nombre del usuario (join).

2. Crea la página /settings/audit:
   - Solo admin. Verificar permisos al inicio.
   - Filtros: rango de fechas, usuario (select), tipo de acción (select),
     tipo de recurso (select).
   - Tabla con columnas: fecha/hora, usuario, acción, recurso, detalles.
   - Paginación.
   - Los filtros se aplican en el servidor (no filtrar en el cliente).
   - No hay acciones de edición ni eliminación.

Verifica: como admin, puedes ver el log de auditoría con todas las acciones
realizadas (logins, creación de pacientes, notas, etc.).
Verifica: los filtros funcionan correctamente.
Verifica: un doctor o receptionist NO puede acceder a esta página.
```

---

## Módulo 10 — Dashboard

```
Implementa el dashboard principal (/):

1. Crea queries en src/queries/dashboard.ts:
   - getDashboardStats(clinicId): retorna:
     - Total de pacientes activos.
     - Citas de hoy (total + por estado).
     - Consultas del mes (notas clínicas creadas este mes).
     - Pacientes nuevos este mes.

2. Actualiza src/app/(dashboard)/page.tsx:
   - StatsCards: 4 cards con los contadores arriba.
   - TodayAppointments: lista de las citas de hoy del usuario actual
     (si es doctor, solo las suyas; si es admin/receptionist, todas).
     Reutilizar TodayQueue del módulo 6.
   - Para doctor: mostrar "Próximo paciente" destacado con botón directo
     a la ficha.

Verifica: el dashboard muestra datos reales del seed.
Verifica: los contadores se actualizan al crear pacientes/citas.
```

---

## Módulo 11 — Configuración (clínica + usuarios + import CSV)

```
Lee docs/PRD-TECNICO.md secciones 2 (permisos), 3 (rutas de settings)
y 4 (server actions de users).

1. Página /settings: Configuración de la clínica.
   - Solo admin.
   - ClinicSettings: formulario con nombre, dirección, teléfono, timezone.
   - Server Action updateClinicSettings.

2. Página /settings/users: Gestión de usuarios.
   - Solo admin.
   - Tabla de usuarios: nombre, email, rol, estado (activo/inactivo), última sesión.
   - Botón "Nuevo usuario" que abre modal con formulario.
   - Acciones por usuario: editar (rol, nombre), resetear contraseña, desactivar.
   - El admin NO puede desactivarse a sí mismo.
   - Server Actions: createUser, updateUser, resetUserPassword según PRD sección 4.

3. Página /settings/import: Importación de pacientes desde CSV.
   - Solo admin.
   - CsvImporter:
     a) Upload del CSV.
     b) Preview: tabla con las primeras 10 filas.
     c) Mapeo de columnas: el sistema intenta auto-detectar (nombre, cédula, teléfono, fecha_nacimiento, sexo).
        El admin puede corregir el mapeo manualmente con selects.
     d) Validación: mostrar errores por fila (cédula duplicada, campos faltantes).
     e) Confirmación: "Se importarán X pacientes. ¿Confirmar?"
     f) Resultado: "X importados, Y errores" con detalle de errores.
   - Usar papaparse para parsear el CSV en el frontend.
   - La importación real se hace en una Server Action que procesa en batch.

Verifica: puedes crear un usuario nuevo, cambiar su rol, resetear su contraseña.
Verifica: puedes importar un CSV de pacientes y verlos en la lista de pacientes.
Verifica: duplicados por cédula se detectan y reportan.
```

---

## Módulo 12 — Permisos finales + hardening

```
Este módulo es una revisión de seguridad de todo lo construido.

1. Revisa CADA Server Action y verifica que:
   - Llama a requireSession() o requireRole() al inicio.
   - Filtra por clinic_id en toda query.
   - El receptionist NO puede: ver/editar historia clínica, ver/crear notas,
     ver internal_notes, eliminar adjuntos, gestionar usuarios, ver auditoría.
   - Las notas firmadas NO se pueden editar ni eliminar.

2. Revisa los Route Handlers (/api/auth/*, /api/attachments/*):
   - Verifican autenticación.
   - Verifican clinic_id.
   - Rate limiting en login funciona.

3. Verifica security headers en next.config.ts:
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Referrer-Policy: strict-origin-when-cross-origin
   - Strict-Transport-Security (solo prod)
   - Content-Security-Policy básica

4. Verifica que:
   - Ningún archivo adjunto es accesible sin autenticación.
   - Los tokens JWT expiran correctamente.
   - El logout invalida la sesión.
   - Las contraseñas se hashean con argon2id (no bcrypt, no plain text).
   - Las cookies tienen HttpOnly, Secure (prod), SameSite=Lax.
   - No hay console.log con datos sensibles en producción.

5. Si encuentras alguna violación de seguridad, corrígela inmediatamente
   y documenta qué se corrigió.
```

---

## Módulo 13 — Testing e2e

```
Configura e implementa tests para los flujos críticos:

1. Configura Playwright para e2e tests.
   - Crear playwright.config.ts con baseURL localhost:3000.
   - Configurar el test para que levante el dev server.

2. Tests e2e (en tests/e2e/):

   a) test: login-flow.spec.ts
      - Login con credenciales correctas → redirige a dashboard.
      - Login con credenciales incorrectas → muestra error.
      - Acceder a /patients sin login → redirige a /login.

   b) test: patient-flow.spec.ts
      - Login como receptionist.
      - Crear paciente nuevo con datos completos.
      - Buscar el paciente por cédula.
      - Abrir la ficha del paciente.
      - Verificar que NO puede ver la historia clínica.

   c) test: consultation-flow.spec.ts
      - Login como doctor.
      - Abrir agenda del día.
      - Marcar asistencia de un paciente.
      - Abrir ficha del paciente.
      - Crear nota de evolución con datos SOAP.
      - Firmar la nota.
      - Verificar que la nota firmada no se puede editar.
      - Agendar próxima cita.

   d) test: permissions.spec.ts
      - Login como receptionist.
      - Intentar acceder a /settings/users → redirigido o 403.
      - Intentar acceder a /settings/audit → redirigido o 403.
      - Intentar acceder a /patients/[id]/history → redirigido o 403.
      - Intentar acceder a /patients/[id]/notes → redirigido o 403.

3. Tests unitarios con Vitest (en tests/unit/):
   - Validaciones Zod: verificar que schemas aceptan datos válidos
     y rechazan datos inválidos.
   - Auth: verificar generación y verificación de tokens.
   - Permisos: verificar la función requireRole con cada rol.

Verifica: todos los tests pasan con pnpm test y pnpm test:e2e.
```

---

## Post-construcción — Deploy

```
Prepara el proyecto para producción:

1. Crea un Dockerfile multi-stage:
   - Stage 1: install dependencies (pnpm install --frozen-lockfile)
   - Stage 2: build (pnpm build)
   - Stage 3: production (node, solo dependencias de producción)
   - Usar node:20-alpine como base.

2. Actualiza docker-compose.yml para producción:
   - Servicio app (from Dockerfile) en puerto 3000.
   - Servicio PostgreSQL con volumen persistente.
   - Health checks para ambos servicios.
   - Restart policy: unless-stopped.
   - Variables de entorno desde .env.

3. Crea un script de backup: scripts/backup-db.sh
   - pg_dump comprimido con fecha.
   - Retención de 30 días (borrar los más viejos).

4. Configura GitHub Actions (.github/workflows/ci.yml):
   - On push to main: lint, type-check, test, build.
   - No deploy automático por ahora (deploy manual con ssh + docker compose pull).

5. Documenta el proceso de deploy en docs/DEPLOY.md:
   - Requisitos del servidor (2GB RAM, Docker, Caddy/Nginx para HTTPS).
   - Configurar dominio + HTTPS con Caddy.
   - Variables de entorno de producción.
   - Cómo restaurar un backup.

Verifica: docker compose up -d levanta la app y la DB en producción mode.
Verifica: la app es accesible en el puerto 3000.
Verifica: GitHub Actions pasa en un push a main.
```
