# CLÍNICA MVP — Documento Fundacional de Producto

**Historia Clínica Electrónica para Consultorios Especializados**
**Versión:** 1.0 — Abril 2026
**Estado:** Borrador estratégico para validación

---

## SECCIÓN 1 — RESUMEN EJECUTIVO

### Qué estamos creando

Un sistema de historia clínica electrónica (HCE) diseñado específicamente para consultorios privados especializados en Latinoamérica — empezando por clínicas de ginecología y medicina reproductiva en Venezuela. El producto prioriza el flujo real de consulta por encima de la completitud funcional: que el médico pueda atender, documentar y dar seguimiento sin fricción.

### Qué problema resuelve

Los consultorios especializados pequeños y medianos en Latinoamérica operan con una combinación caótica de Excel, WhatsApp, cuadernos, y a veces software genérico o desactualizado. Esto genera pérdida de información clínica, imposibilidad de dar seguimiento real a pacientes, cero trazabilidad, riesgo legal y frustración diaria. No existe un producto que sea simultáneamente simple, seguro, rápido de implementar y adaptado al flujo real de estas especialidades.

### Para quién

Consultorios privados de 1 a 10 médicos especialistas con equipo administrativo pequeño (1-4 personas). Mercado inicial: clínicas de ginecología, fertilidad y medicina reproductiva en Venezuela.

### Por qué podría venderse

- Los médicos privados en LATAM están digitalizándose rápido pero las opciones son malas: software viejo, genérico, caro o complejo.
- El dolor es real y cotidiano: pierden fichas, no pueden consultar historiales, no tienen respaldo.
- El ticket es accesible y recurrente (SaaS mensual).
- La competencia local es débil y los productos internacionales no se adaptan al contexto.
- Tenemos acceso directo al mercado venezolano.

### Qué NO es este producto

- No es un sistema hospitalario (HIS).
- No es un ERP clínico con facturación electrónica, inventario de farmacia ni contabilidad.
- No es una plataforma de telemedicina.
- No es un sistema multi-especialidad genérico desde el día 1.
- No pretende cumplir certificaciones tipo HIPAA o HL7 en el MVP — pero se diseña con estándares altos para no tener que reescribir después.

---

## SECCIÓN 2 — HIPÓTESIS DE NEGOCIO

### Problema principal

Los médicos especialistas en consultorios privados no tienen forma práctica de mantener un historial clínico digital completo, seguro y consultable. Trabajan con herramientas fragmentadas que no fueron diseñadas para el flujo médico.

### Usuario comprador

**El médico dueño del consultorio o director clínico.** Es quien toma la decisión de compra. Le importa: que funcione rápido, que no le quite tiempo, que pueda ver el historial completo de un paciente en segundos, que se vea profesional frente al paciente. No quiere un proyecto de TI, quiere una herramienta que funcione.

### Usuario operador

**Recepcionista o asistente administrativa.** Es quien más interactúa con el sistema en volumen: agenda citas, registra pacientes, confirma asistencia, busca fichas. Necesita velocidad y simplicidad. Nivel técnico bajo-medio.

### Usuario clínico

**El médico en consulta.** Necesita abrir la ficha del paciente, ver antecedentes, escribir la evolución, cargar resultados, indicar tratamiento y agendar la siguiente cita — todo en el tiempo de una consulta (15-30 minutos). No tolerará un sistema lento o con muchos clics.

### Dolor actual

| Herramienta actual | Dolor |
|---|---|
| Cuadernos/papel | Se pierden, no son buscables, ilegibles, sin respaldo |
| Excel/Google Sheets | Sin estructura clínica, sin permisos, sin auditoría, crece mal |
| WhatsApp | Adjuntos perdidos en el chat, cero privacidad, sin historial estructurado |
| Software viejo (escritorio) | No se accede desde fuera, no hay soporte, interfaz anticuada, sin backups en la nube |
| Software genérico internacional | Caro, complejo, no se adapta al flujo local, soporte en inglés |

### Alternativas actuales

- **Papel + carpetas:** Todavía común en consultorios pequeños.
- **Excel/Google Sheets:** Opción gratuita pero inadecuada para datos médicos.
- **Software de escritorio viejo:** Instalaciones locales sin mantenimiento.
- **Sistemas hospitalarios adaptados:** Oversized, caros, difíciles de implementar.
- **Galenos, MedStar, DrCloud y similares:** Algunos cubren parcialmente pero con UX pobre, sin soporte local, o sin adaptación por especialidad.

### Propuesta de valor

**"Tu consultorio funcionando en digital en una semana."** Un sistema que un consultorio especializado puede adoptar sin proyecto de TI: se configura, se capacita en pocas horas y el médico puede empezar a atender con historia clínica digital el mismo día. Diseñado para el flujo de la consulta, no para cumplir un checklist de funcionalidades.

### Diferenciadores defensables

1. **Verticalidad por especialidad:** Plantillas y flujos adaptados al nicho (ginecología/fertilidad), no un formulario genérico.
2. **Velocidad de implementación:** Onboarding de un consultorio en 1-3 días, no semanas.
3. **UX clínica real:** Diseñado alrededor del flujo de consulta, no de la administración.
4. **Presencia local:** Soporte en español, conocimiento del mercado venezolano, capacitación presencial posible.
5. **Precio accesible con modelo SaaS:** Sin inversión inicial grande.

### Riesgos comerciales

- **Capacidad de pago del mercado venezolano:** Inestabilidad económica. Mitigación: precio en USD, modelos flexibles, expandir a otros países LATAM rápido.
- **Resistencia al cambio:** Médicos acostumbrados al papel. Mitigación: onboarding asistido, demostrar valor en la primera semana.
- **Competencia futura:** Productos internacionales podrían bajar precio o adaptarse. Mitigación: construir relación y lock-in con datos y flujos configurados.
- **Regulación cambiante:** Si Venezuela o el país objetivo impone requisitos técnicos. Mitigación: diseñar con estándares altos desde el inicio.

### Riesgos de adopción

- El médico lo usa la primera semana y luego vuelve al papel porque "es más rápido."
- La recepcionista no recibe capacitación suficiente y genera datos basura.
- El consultorio no tiene buena conexión a internet.
- No se migran los datos históricos y el sistema parece vacío/inútil.

---

## SECCIÓN 3 — NICHO INICIAL RECOMENDADO

### Evaluación de nichos

| Criterio | Ginecología + Fertilidad | Estética / Antienvejecimiento | Pediatría especializada |
|---|---|---|---|
| **Urgencia del problema** | **Alta.** Seguimiento de ciclos, tratamientos largos, resultados de laboratorio. El papel no alcanza. | Media. Consultas más cortas, menos datos críticos. | Alta. Pero mercado más fragmentado. |
| **Complejidad del producto** | **Media.** Necesita plantillas específicas (ciclo menstrual, protocolos de fertilidad, ecografías) pero los flujos son bien definidos. | **Baja.** Procedimientos estéticos, fotos antes/después, productos. Más simple. | Alta. Múltiples subespecialidades, vacunas, crecimiento. |
| **Ticket esperado** | **Alto.** Clínicas de fertilidad manejan pacientes de ticket alto. Pueden pagar $50-150/mes. | Medio. $30-80/mes. | Medio-bajo. |
| **Dificultad de venta** | **Media.** Son clínicas sofisticadas, entienden el valor. | Baja. Son más informales, deciden rápido. | Alta. Más conservadores. |
| **Velocidad de implementación** | **Alta.** Flujos claros, especialidad bien definida. | Muy alta. Pocos datos médicos complejos. | Media. Mucha variabilidad. |
| **Potencial de expansión** | **Alto.** De fertilidad a ginecología general. Gran mercado. | Medio. Es un nicho en crecimiento pero más superficial. | Medio. |
| **Acceso comercial** | **Alto si hay contactos.** | Alto. Muchas clínicas nuevas. | Medio. |

### Recomendación: Ginecología + Medicina Reproductiva

**Nicho inicial:** Consultorios y clínicas pequeñas de ginecología con enfoque en fertilidad y medicina reproductiva.

**Razones:**

1. **El dolor es real y cuantificable:** Una paciente de fertilidad puede tener 20-50 visitas en un tratamiento. Sin historial digital, el seguimiento es un caos.
2. **El flujo clínico es bien definido:** Consulta inicial → estudios → protocolo → seguimiento → resultado. Es modelable.
3. **El ticket justifica el producto:** Las pacientes pagan en USD (especialmente en LATAM). El consultorio puede pagar un SaaS.
4. **La expansión es natural:** De fertilidad a ginecología general, y de ahí a obstetricia, son pasos lógicos.
5. **Hay diferenciación clara:** Plantillas de ciclo menstrual, protocolos de estimulación, seguimiento folicular, espermograma, etc. Esto no lo tiene un EHR genérico.

**Supuesto crítico:** Asumimos que Angel tiene acceso a al menos 1-2 clínicas de este tipo en Venezuela para pilotar. Si no, el segundo candidato es estética/antienvejecimiento por su menor barrera de entrada.

---

## SECCIÓN 4 — DEFINICIÓN DEL MVP

### Principio rector

El MVP debe permitir que **un consultorio de ginecología/fertilidad reemplace el cuaderno y el Excel** para el registro y consulta de historias clínicas. Nada más, nada menos.

### Qué SÍ incluye el MVP

1. **Registro de pacientes** con datos demográficos y antecedentes básicos.
2. **Agenda de citas** simple (crear, ver, cancelar, marcar asistencia).
3. **Historia clínica** con plantilla base de ginecología (antecedentes ginecológicos, obstétricos, quirúrgicos).
4. **Notas de evolución** por consulta (texto semiestructurado).
5. **Carga de adjuntos** (resultados de laboratorio, ecografías en imagen/PDF).
6. **Usuarios y roles** (médico, recepcionista, admin).
7. **Auditoría básica** (quién hizo qué, cuándo).
8. **Búsqueda de pacientes** rápida.
9. **Vista resumen del paciente** (toda la historia en una pantalla).

### Qué NO incluye el MVP

- Facturación o cobros.
- Prescripción electrónica con catálogo de medicamentos.
- Telemedicina o videollamada.
- Portal del paciente.
- Integración con laboratorios externos.
- Reportes estadísticos avanzados.
- Multi-sede (se diseña para una sede, pero la arquitectura lo permite después).
- Notificaciones automáticas (recordatorios de cita por SMS/WhatsApp).
- Módulo de consentimiento informado digital.
- CIE-10 obligatorio (se puede agregar como campo opcional).

### Módulo núcleo

**Historia clínica + Notas de evolución.** Si esto no funciona bien, nada más importa. El médico debe poder abrir un paciente, ver todo su historial y escribir la nota de hoy en menos de 60 segundos.

### Módulo que puede esperar

- Reportes y estadísticas.
- Recordatorios y notificaciones.
- Consentimientos digitales.
- Integración con calendario externo.

### Flujo que debe funcionar perfecto desde v1

```
Recepcionista agenda cita → Paciente llega → Recepcionista marca asistencia →
Médico abre ficha del paciente → Ve historial completo →
Escribe nota de evolución de hoy → Adjunta resultado si hay →
Indica próxima cita → Guarda todo → Siguiente paciente
```

Este flujo debe tomar **menos de 3 minutos de interacción con el sistema** por consulta.

### Errores de scope a evitar

1. **No construir un agendador sofisticado.** La agenda del MVP es un calendario simple con franjas. No necesitamos disponibilidad en tiempo real, salas, ni multi-profesional.
2. **No construir un formulario dinámico genérico.** Las plantillas clínicas del MVP pueden ser semi-fijas con campos configurables. No necesitamos un form builder.
3. **No construir un visor de imágenes médico.** Los adjuntos se suben y descargan. No necesitamos un visor DICOM.
4. **No construir un sistema de facturación "básico".** La facturación "básica" no existe. O se hace bien o no se hace.
5. **No construir multi-idioma.** El MVP es en español.
6. **No obsesionarse con la app móvil.** Web responsive es suficiente para el MVP. Una PWA puede venir después.

---

## SECCIÓN 5 — PERSONAS Y CASOS DE USO

### Persona 1: Dra. María — Ginecóloga especialista en fertilidad

- **Edad:** 38 años
- **Contexto:** Tiene su consultorio privado con 1 recepcionista. Atiende 15-20 pacientes/día. También trabaja medio turno en una clínica grande.
- **Objetivos:** Ver rápidamente el historial de la paciente, documentar cada consulta sin perder tiempo, dar seguimiento a tratamientos de fertilidad que duran meses.
- **Frustraciones:** Pierde tiempo buscando en carpetas físicas. A veces no encuentra resultados de laboratorio. Cuando la paciente llama para preguntar algo, no puede consultar la ficha sin estar en el consultorio. Le da miedo que se pierda información médica importante.
- **Tareas frecuentes:** Abrir ficha de paciente, leer antecedentes, escribir evolución, revisar resultados previos, indicar próximos estudios, agendar control.
- **Nivel técnico:** Medio. Usa smartphone, WhatsApp, Instagram. No es técnica pero aprende rápido si la herramienta es intuitiva.

### Persona 2: Carmen — Recepcionista

- **Edad:** 28 años
- **Contexto:** Trabaja de lunes a viernes en el consultorio. Maneja la agenda, recibe pacientes, cobra consultas (en efectivo o transferencia), y organiza las carpetas.
- **Objetivos:** Tener la agenda del día clara, poder encontrar a cualquier paciente en segundos, no perder información, quedar bien con la doctora.
- **Frustraciones:** El cuaderno de citas se llena de tachones. A veces agenda doble por error. No sabe si la doctora ya anotó algo o no. Las carpetas se desordenan.
- **Tareas frecuentes:** Agendar citas, confirmar asistencia, registrar pacientes nuevos, buscar fichas, recibir y archivar resultados.
- **Nivel técnico:** Bajo-medio. Sabe usar Excel básico y WhatsApp. Necesita una interfaz muy clara.

### Persona 3: Dr. Andrés — Administrador / Socio

- **Edad:** 45 años
- **Contexto:** Es el dueño o socio de la clínica. Tiene 3 médicos trabajando. Le preocupa la operación, los costos y la seguridad.
- **Objetivos:** Saber que la información de los pacientes está segura. Ver métricas básicas (cuántos pacientes se atendieron, por médico). Controlar quién accede a qué.
- **Frustraciones:** No sabe si sus médicos documentan bien. No tiene visibilidad de la operación. Le preocupa un problema legal por pérdida de datos.
- **Tareas frecuentes:** Revisar reportes (futuro), gestionar usuarios, configurar el sistema.
- **Nivel técnico:** Medio. Usa bien la computadora pero no es técnico.

### Persona 4: Ana — Paciente (fase futura)

- **Edad:** 33 años
- **Contexto:** Está en tratamiento de fertilidad. Va al consultorio cada 2-4 semanas. Quiere saber sus próximas citas y tener acceso a sus resultados.
- **Objetivos:** No perder resultados de laboratorio. Recordar cuándo es su próxima cita. Sentir que su médico tiene todo bajo control.
- **Frustraciones:** Le mandan resultados por WhatsApp y se pierden. No recuerda cuándo le toca ir. A veces la doctora le pide que traiga resultados anteriores y no los encuentra.
- **Tareas frecuentes:** Consultar su próxima cita, ver sus resultados, comunicarse con el consultorio.
- **Nivel técnico:** Medio-alto. Usa apps a diario.
- **NOTA:** Ana NO es usuario del MVP. Se menciona porque el diseño debe contemplar un portal de paciente futuro.

### 15 Casos de uso principales

| # | Caso de uso | Actor principal | Prioridad |
|---|---|---|---|
| 1 | Registrar paciente nueva con datos demográficos y antecedentes | Recepcionista | MVP |
| 2 | Buscar paciente por nombre, cédula o teléfono | Recepcionista / Médico | MVP |
| 3 | Agendar cita para paciente existente | Recepcionista | MVP |
| 4 | Ver agenda del día con lista de pacientes citados | Recepcionista / Médico | MVP |
| 5 | Marcar llegada/asistencia de paciente | Recepcionista | MVP |
| 6 | Abrir historia clínica completa de una paciente | Médico | MVP |
| 7 | Escribir nota de evolución de la consulta de hoy | Médico | MVP |
| 8 | Adjuntar resultado de laboratorio o imagen (PDF/foto) | Médico / Recepcionista | MVP |
| 9 | Ver historial cronológico de todas las consultas y adjuntos | Médico | MVP |
| 10 | Registrar antecedentes ginecológicos y obstétricos | Médico | MVP |
| 11 | Indicar próxima cita desde la pantalla de consulta | Médico | MVP |
| 12 | Crear/editar usuarios del sistema y asignar roles | Administrador | MVP |
| 13 | Ver log de auditoría (quién accedió a qué ficha) | Administrador | MVP |
| 14 | Cancelar o reprogramar una cita | Recepcionista | MVP |
| 15 | Ver reporte de consultas realizadas por período | Administrador | Post-MVP |

---

## SECCIÓN 6 — FLUJO OPERATIVO REAL

### Flujo completo de una consulta

**Antes de la consulta:**

| Paso | Cómo se hace HOY | Cómo lo mejora el sistema |
|---|---|---|
| 1. Paciente solicita cita (llamada/WhatsApp) | Se anota en cuaderno o agenda de papel. Riesgo de doble agendamiento. | Recepcionista abre la agenda digital, ve horarios disponibles, agenda en 3 clics. El sistema previene solapamientos. |
| 2. Confirmación de cita | Se llama por teléfono o se manda WhatsApp manual. | (MVP: sigue siendo manual. Post-MVP: recordatorio automático.) |

**El día de la consulta:**

| Paso | Cómo se hace HOY | Cómo lo mejora el sistema |
|---|---|---|
| 3. Paciente llega al consultorio | Recepcionista busca en cuaderno si tiene cita. Busca la carpeta física. | Recepcionista ve la lista de pacientes del día. Con un clic, marca "llegó". |
| 4. Si es paciente nueva: registro | Se llena un formulario en papel que la paciente completa a mano. | Recepcionista registra en el sistema: datos básicos en 2 minutos. La paciente no necesita llenar papel. |
| 5. Médico llama a la paciente | Ve su agenda en papel. No sabe si la paciente ya llegó. | Ve la lista del día con estado "en espera". Clic → se abre la ficha. |
| 6. Médico revisa antecedentes | Busca en la carpeta, lee notas previas (si las encuentra). | Abre la vista resumen: antecedentes, últimas consultas, adjuntos recientes — todo en una pantalla. |
| 7. Consulta médica | Escucha, examina, toma notas en papel. | Toma notas directamente en la evolución digital. Puede usar plantilla de la especialidad o texto libre. |
| 8. Revisión de resultados | La paciente trae resultados impresos o en el celular. | El médico ve resultados ya cargados en el sistema, o los sube en el momento. |
| 9. Indicaciones y tratamiento | Escribe a mano en receta. A veces la paciente no entiende la letra. | Escribe indicaciones en el sistema (texto). Puede imprimir o compartir. (MVP no incluye prescripción electrónica con catálogo.) |
| 10. Agendar próxima cita | Le dice a la recepcionista "agéndala en 2 semanas". | Desde la pantalla de consulta, selecciona "agendar siguiente" → la recepcionista completa el horario. |

**Después de la consulta:**

| Paso | Cómo se hace HOY | Cómo lo mejora el sistema |
|---|---|---|
| 11. Archivar documentos | La recepcionista mete papeles en la carpeta. | Todo ya está en el sistema. No hay que archivar nada físico (aunque pueden imprimir si quieren). |
| 12. Seguimiento futuro | No hay mecanismo. Depende de la memoria del médico. | El historial cronológico muestra la última nota y cuándo es la próxima cita. Post-MVP: alertas de seguimiento. |

---

## SECCIÓN 7 — ESTRUCTURA FUNCIONAL DEL PRODUCTO

### Módulos del sistema

#### 1. Pacientes
- **Objetivo:** Registro, búsqueda y gestión del directorio de pacientes.
- **Usuarios:** Recepcionista (crea/edita), Médico (consulta/edita datos clínicos).
- **Datos:** Datos demográficos, contacto, identificación, seguro (si aplica), notas generales.
- **Prioridad:** Alta.
- **MVP:** Sí.

#### 2. Agenda / Citas
- **Objetivo:** Gestión de citas diarias del consultorio.
- **Usuarios:** Recepcionista (gestiona), Médico (consulta agenda del día).
- **Datos:** Fecha, hora, paciente, médico, motivo breve, estado (agendada, confirmada, en espera, atendida, cancelada, no asistió).
- **Prioridad:** Alta.
- **MVP:** Sí. Versión simple: vista diaria/semanal, crear/editar/cancelar cita. Sin multi-recurso ni multi-sala.

#### 3. Historia clínica
- **Objetivo:** Registro estructurado de la información médica base del paciente.
- **Usuarios:** Médico (principal), Recepcionista (lectura parcial de datos no clínicos).
- **Datos:** Antecedentes personales, familiares, quirúrgicos, alérgicos. Para ginecología: antecedentes ginecológicos (menarquía, ciclos, métodos anticonceptivos, Papanicolaou, mamografía) y obstétricos (gestas, partos, cesáreas, abortos).
- **Prioridad:** Crítica.
- **MVP:** Sí. Con plantilla semi-fija para ginecología.

#### 4. Notas de evolución / Consultas
- **Objetivo:** Documentar cada visita del paciente.
- **Usuarios:** Médico.
- **Datos:** Fecha, motivo de consulta, examen físico, hallazgos, diagnóstico (texto libre + CIE-10 opcional), plan, indicaciones, notas internas.
- **Prioridad:** Crítica.
- **MVP:** Sí. Con formato SOAP (Subjetivo, Objetivo, Análisis, Plan) como sugerencia pero no obligatorio.

#### 5. Adjuntos / Documentos
- **Objetivo:** Almacenar resultados de laboratorio, imágenes, consentimientos, etc.
- **Usuarios:** Médico, Recepcionista (carga), Médico (consulta).
- **Datos:** Archivo (PDF, imagen), tipo de documento, fecha, descripción, paciente asociado, consulta asociada (opcional).
- **Prioridad:** Alta.
- **MVP:** Sí. Carga de archivos con categorización simple. Sin visor especializado.

#### 6. Usuarios y roles
- **Objetivo:** Control de acceso al sistema.
- **Usuarios:** Administrador.
- **Datos:** Nombre, email, rol (admin, médico, recepcionista), estado (activo/inactivo), consultorio/sede.
- **Prioridad:** Crítica.
- **MVP:** Sí. Tres roles fijos. Sin permisos granulares por módulo (viene después).

#### 7. Auditoría
- **Objetivo:** Registro de acciones relevantes para trazabilidad y seguridad.
- **Usuarios:** Administrador (consulta).
- **Datos:** Quién, qué acción, sobre qué recurso, cuándo, IP (opcional).
- **Prioridad:** Alta.
- **MVP:** Sí. Log append-only. Vista básica filtrable por fecha y usuario.

#### 8. Reportes mínimos
- **Objetivo:** Visibilidad básica de la operación.
- **Usuarios:** Administrador, Médico.
- **Datos:** Consultas por período, pacientes nuevos por período, citas canceladas.
- **Prioridad:** Media.
- **MVP:** Parcial. Dashboard simple con contadores. Sin reportes exportables sofisticados.

#### 9. Configuración del consultorio
- **Objetivo:** Datos del consultorio, horarios de atención, profesionales.
- **Usuarios:** Administrador.
- **Datos:** Nombre del consultorio, dirección, horarios, especialidades, logo.
- **Prioridad:** Media.
- **MVP:** Sí, pero mínimo: nombre, horarios, médicos.

#### Módulos que NO entran al MVP

| Módulo | Razón de exclusión |
|---|---|
| Facturación | Complejidad alta, requisitos fiscales locales, no es el core. |
| Prescripción electrónica | Requiere catálogo de medicamentos y validación. Texto libre es suficiente por ahora. |
| Portal del paciente | Requiere auth separada, diseño de permisos, y no es urgente. |
| Notificaciones (SMS/WhatsApp) | Requiere integración con APIs externas y costos operativos. |
| Telemedicina | Fuera de alcance total. |
| Integración con laboratorios | Requiere estándares como HL7/FHIR. |
| Inventario / Insumos | No es el core del producto. |

---

## SECCIÓN 8 — MODELO DE DATOS INICIAL

### Entidades principales y relaciones

```
Clinic (1) ──── (N) User
Clinic (1) ──── (N) Patient
Patient (1) ──── (1) MedicalHistory
Patient (1) ──── (N) Appointment
Patient (1) ──── (N) ClinicalNote
Patient (1) ──── (N) Attachment
ClinicalNote (1) ──── (N) Attachment
User (1) ──── (N) ClinicalNote    [author]
User (1) ──── (N) Appointment     [doctor / created_by]
User (1) ──── (N) AuditLog
```

### Entidades con campos esenciales

#### Clinic
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| id | UUID | Sí | PK |
| name | string | Sí | |
| address | string | No | |
| phone | string | No | |
| timezone | string | Sí | Default: America/Caracas |
| created_at | timestamp | Sí | |

#### User
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| id | UUID | Sí | PK |
| clinic_id | UUID | Sí | FK → Clinic |
| email | string | Sí | Único por clinic |
| password_hash | string | Sí | bcrypt/argon2 |
| full_name | string | Sí | |
| role | enum | Sí | admin, doctor, receptionist |
| is_active | boolean | Sí | Default: true |
| created_at | timestamp | Sí | |
| last_login_at | timestamp | No | |

#### Patient
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| id | UUID | Sí | PK |
| clinic_id | UUID | Sí | FK → Clinic |
| id_number | string | Sí | Cédula / pasaporte. Único por clinic. |
| id_type | enum | Sí | cedula, passport, other |
| first_name | string | Sí | |
| last_name | string | Sí | |
| date_of_birth | date | Sí | |
| sex | enum | Sí | F, M, other |
| phone | string | No | |
| email | string | No | |
| address | text | No | |
| emergency_contact_name | string | No | |
| emergency_contact_phone | string | No | |
| insurance_info | text | No | Texto libre por ahora |
| notes | text | No | Notas administrativas |
| is_active | boolean | Sí | Soft delete |
| created_at | timestamp | Sí | |
| created_by | UUID | Sí | FK → User |

#### MedicalHistory (antecedentes — 1:1 con Patient)
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| id | UUID | Sí | PK |
| patient_id | UUID | Sí | FK → Patient. Único. |
| personal_history | text | No | Antecedentes personales (texto libre) |
| family_history | text | No | Antecedentes familiares |
| surgical_history | text | No | Antecedentes quirúrgicos |
| allergies | text | No | |
| current_medications | text | No | Medicación actual |
| habits | text | No | Tabaco, alcohol, ejercicio |
| **specialty_data** | **JSONB** | **No** | **Campos específicos de la especialidad** |
| updated_at | timestamp | Sí | |
| updated_by | UUID | Sí | FK → User |

**Decisión clave: `specialty_data` como JSONB.**
Para ginecología, este campo contiene:
```json
{
  "menarche_age": 12,
  "cycle_length_days": 28,
  "cycle_regularity": "regular",
  "last_menstrual_period": "2026-03-15",
  "contraceptive_method": "none",
  "pap_smear_last": "2025-08",
  "mammography_last": null,
  "gravida": 2,
  "para": 1,
  "cesarean": 0,
  "abortions": 1,
  "living_children": 1,
  "obstetric_notes": "..."
}
```
Esto permite agregar campos por especialidad sin alterar el esquema de la base de datos. El frontend renderiza un formulario específico según la especialidad configurada en la clínica.

#### Appointment
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| id | UUID | Sí | PK |
| clinic_id | UUID | Sí | FK → Clinic |
| patient_id | UUID | Sí | FK → Patient |
| doctor_id | UUID | Sí | FK → User (role=doctor) |
| date | date | Sí | |
| start_time | time | Sí | |
| end_time | time | No | |
| status | enum | Sí | scheduled, confirmed, waiting, in_progress, completed, cancelled, no_show |
| reason | string | No | Motivo breve |
| notes | text | No | Notas de recepción |
| created_by | UUID | Sí | FK → User |
| created_at | timestamp | Sí | |
| cancelled_at | timestamp | No | |
| cancelled_by | UUID | No | FK → User |

#### ClinicalNote
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| id | UUID | Sí | PK |
| patient_id | UUID | Sí | FK → Patient |
| appointment_id | UUID | No | FK → Appointment (puede haber notas sin cita) |
| author_id | UUID | Sí | FK → User |
| note_date | date | Sí | |
| chief_complaint | text | No | Motivo de consulta |
| subjective | text | No | Lo que relata la paciente |
| objective | text | No | Examen físico, signos vitales |
| assessment | text | No | Diagnóstico / impresión diagnóstica |
| plan | text | No | Plan terapéutico |
| diagnosis_text | string | No | Texto libre del diagnóstico |
| diagnosis_code | string | No | CIE-10 opcional |
| internal_notes | text | No | Solo visible para médicos |
| **specialty_data** | **JSONB** | **No** | **Campos específicos por tipo de consulta** |
| is_signed | boolean | Sí | Default: false. Una vez firmada, no se edita. |
| signed_at | timestamp | No | |
| created_at | timestamp | Sí | |
| updated_at | timestamp | Sí | |

#### Attachment
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| id | UUID | Sí | PK |
| patient_id | UUID | Sí | FK → Patient |
| clinical_note_id | UUID | No | FK → ClinicalNote |
| uploaded_by | UUID | Sí | FK → User |
| file_name | string | Sí | Nombre original |
| storage_key | string | Sí | Key en object storage (UUID + extensión, nunca el nombre original) |
| file_type | string | Sí | MIME type |
| file_size | integer | Sí | Bytes |
| category | enum | No | lab_result, imaging, consent, prescription, other |
| description | string | No | |
| uploaded_at | timestamp | Sí | |

#### AuditLog
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| id | UUID | Sí | PK |
| clinic_id | UUID | Sí | |
| user_id | UUID | Sí | FK → User |
| action | string | Sí | CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT |
| resource_type | string | Sí | patient, clinical_note, attachment, etc. |
| resource_id | UUID | No | |
| details | JSONB | No | Datos adicionales del evento |
| ip_address | string | No | |
| created_at | timestamp | Sí | Inmutable |

### Campos configurables por especialidad

El campo `specialty_data` (JSONB) en `MedicalHistory` y `ClinicalNote` es el mecanismo de extensibilidad. Cada especialidad define un schema JSON que el frontend usa para renderizar el formulario. Esto permite:

- Agregar fertilidad, dermatología, urología, etc. sin migrar la base de datos.
- Que cada clínica configure qué campos necesita.
- Mantener el modelo relacional limpio y estable.

**Trade-off:** Los datos en JSONB no son tan fáciles de consultar con SQL como columnas dedicadas. Para el MVP esto es aceptable. Si se necesitan queries analíticas pesadas sobre estos campos, se pueden crear vistas materializadas o índices GIN (PostgreSQL).

---

## SECCIÓN 9 — REQUISITOS NO FUNCIONALES

### Seguridad
- Autenticación con email + contraseña (con hash fuerte: argon2 o bcrypt).
- Tokens JWT con expiración corta (15-30 min) + refresh token.
- HTTPS obligatorio en producción.
- Rate limiting en login.
- Todo acceso a datos de paciente debe pasar por verificación de rol y clinic_id.

### Trazabilidad
- Toda acción sobre datos de pacientes genera un registro en AuditLog.
- El log de auditoría es append-only: no se puede editar ni borrar.
- Las notas clínicas firmadas son inmutables. Si se necesita corregir, se crea una addenda.

### Rendimiento
- Tiempo de carga de la lista de pacientes: < 1 segundo.
- Apertura de ficha de paciente con historial: < 2 segundos.
- Búsqueda de paciente por nombre/cédula: < 500ms.
- El sistema debe funcionar fluido con hasta 5,000 pacientes y 50,000 notas por clínica.

### Backups
- Backup automático diario de la base de datos.
- Retención mínima: 30 días.
- Backup debe poder restaurarse en menos de 1 hora.
- Adjuntos en storage con redundancia (proveedor de nube).

### Disponibilidad
- Target: 99.5% uptime (permite ~3.6 horas de downtime al mes).
- Para el MVP, aceptable con despliegue en un solo servidor con health checks y reinicio automático.

### Experiencia móvil
- El sistema es web-first pero debe ser usable desde tablet y smartphone.
- Diseño responsive con breakpoints para desktop (1280px+), tablet (768-1279px), y móvil (< 768px).
- El flujo completo de consulta debe funcionar en tablet sin scroll horizontal.
- No se requiere app nativa para el MVP.

### Facilidad de onboarding
- Una clínica nueva debe poder empezar a usar el sistema en máximo 3 días: configurar consultorio, crear usuarios, cargar pacientes existentes (manual o CSV).
- Interfaz autodescriptiva: mínima necesidad de manual.

### Exportación de datos
- Exportar lista de pacientes a CSV.
- Exportar historial de un paciente a PDF (post-MVP, pero diseñar para que sea posible).
- Los datos son del cliente: si se va, debe poder llevarse sus datos.

### Multi-sede
- No está en el MVP, pero el modelo de datos incluye `clinic_id` en todas las tablas para permitirlo después.
- Cada clinic es un tenant lógico. Los datos no se mezclan entre clínicas.

### Escalabilidad razonable
- El sistema debe poder manejar 50 clínicas con 5,000 pacientes cada una sin reescritura.
- PostgreSQL + un servidor de aplicación adecuado cubren esto.
- No necesitamos microservicios, Kubernetes ni nada distribuido para el MVP.

### Mantenibilidad para equipo pequeño
- Monorepo o máximo 2 repositorios (frontend + backend).
- CI/CD automatizado desde el día 1.
- Tests mínimos: tests de integración para los flujos críticos (login, crear paciente, crear nota, permisos).
- Documentación mínima: README actualizado, variables de entorno documentadas, API documentada con OpenAPI/Swagger.

---

## SECCIÓN 10 — PRIVACIDAD Y SEGURIDAD

### Contexto regulatorio

Venezuela no tiene una ley de protección de datos personales robusta al estilo GDPR. Sin embargo, existe la Ley de Ejercicio de la Medicina y principios de secreto médico. **Recomendación: diseñar con estándares altos (alineados a buenas prácticas de HIPAA y GDPR) independientemente del marco legal local.** Esto protege a los pacientes, da confianza al comprador, y facilita expansión a países con regulación más fuerte (Colombia, México, Chile, Argentina).

### Checklist de seguridad y privacidad

#### IMPRESCINDIBLE (debe estar en el MVP)

| Ítem | Descripción |
|---|---|
| HTTPS obligatorio | Todo el tráfico en producción debe ir cifrado en tránsito (TLS 1.2+). |
| Autenticación segura | Contraseñas con hash (argon2id o bcrypt con factor alto). No almacenar contraseñas en texto plano jamás. |
| Tokens con expiración | JWT de acceso con vida corta (15-30 min). Refresh tokens con rotación. |
| Roles y permisos | Tres roles fijos. El recepcionista no puede ver notas clínicas internas. El médico no puede gestionar usuarios. |
| Aislamiento por clínica | Todo query filtra por clinic_id. Un usuario de la clínica A no puede ver datos de la clínica B. |
| Auditoría de acceso | Log de quién accedió a qué ficha, cuándo y desde dónde. Inmutable. |
| Rate limiting en login | Máximo 5 intentos fallidos por IP/usuario en 15 minutos. |
| Validación de entrada | Toda entrada de usuario se valida y sanitiza en el backend. Sin excepciones. |
| CORS restringido | Solo orígenes permitidos. |
| Sesión segura | Cookies HttpOnly, Secure, SameSite. Logout que invalida tokens. |
| Principio de mínimo privilegio | Los endpoints del API verifican rol antes de ejecutar. Ninguna ruta queda "abierta por defecto". |

#### RECOMENDADO (incluir en las primeras semanas post-MVP)

| Ítem | Descripción |
|---|---|
| Cifrado en reposo de la BD | Activar cifrado de disco/volumen en el servidor de base de datos. PostgreSQL soporta esto a nivel de OS/storage. |
| Cifrado de adjuntos | Los archivos sensibles en object storage deben cifrarse con clave gestionada (S3 SSE o equivalente). |
| Backups cifrados | Los backups deben estar cifrados y almacenados en ubicación separada del servidor principal. |
| Política de contraseñas | Mínimo 10 caracteres, validación de complejidad. |
| Bloqueo de cuenta temporal | Tras múltiples intentos fallidos, bloquear cuenta 30 minutos. |
| Logs de eventos de seguridad | Registrar logins fallidos, cambios de contraseña, cambios de rol, exportaciones de datos. |
| Manejo seguro de adjuntos | Archivos servidos a través del backend (no URLs directas al storage). Validación de tipo de archivo. Escaneo básico de malware si es posible. |
| Headers de seguridad | X-Frame-Options, X-Content-Type-Options, Content-Security-Policy, Strict-Transport-Security. |

#### MÁS ADELANTE (fase de producto vendible)

| Ítem | Descripción |
|---|---|
| 2FA / MFA | Segundo factor de autenticación para médicos y admins. |
| Permisos granulares | Permisos configurables por módulo y acción (no solo 3 roles fijos). |
| Permisos por sede | En multi-sede, un médico puede tener acceso a Sede A pero no a Sede B. |
| Registro de consentimiento digital | Consentimiento informado firmado digitalmente por el paciente. |
| Anonimización para estadísticas | Poder generar reportes sin exponer datos identificables. |
| Auditoría exportable | Exportar logs de auditoría en formato estándar para revisión externa. |
| Plan de respuesta a incidentes | Documentar qué hacer si hay una brecha de datos: a quién notificar, cómo contener, cómo comunicar. |
| Penetration testing | Al menos un test de penetración antes de vender a la primera clínica. |
| Política de retención de datos | Definir cuánto tiempo se conservan los datos y cómo se eliminan. |

---

## SECCIÓN 11 — ROADMAP EN FASES

### Fase 0: Discovery (Semanas 1-2)

- **Objetivo:** Validar hipótesis con médicos reales antes de escribir código.
- **Entregables:**
  - 3-5 entrevistas con ginecólogos/personal de clínica.
  - Documentación del flujo real de al menos 2 consultorios.
  - Validación del nicho y de la disposición a pagar.
  - Lista de requisitos ajustada por feedback real.
  - Mockups de baja fidelidad de las pantallas principales.
- **Riesgos:** Que el nicho elegido no tenga la urgencia que asumimos. Que los médicos no quieran pagar.
- **Criterio de salida:** Al menos 1 clínica comprometida a ser piloto. Flujo validado. Equipo alineado en qué se construye.

### Fase 1: MVP Interno (Semanas 3-8)

- **Objetivo:** Construir un producto funcional que cubra el flujo completo de consulta.
- **Entregables:**
  - Sistema desplegado en ambiente de staging.
  - Módulos: Pacientes, Agenda, Historia Clínica, Notas de Evolución, Adjuntos, Usuarios/Roles, Auditoría.
  - Tests de los flujos críticos.
  - Documentación mínima de despliegue y configuración.
- **Riesgos:** Over-engineering. Perder tiempo en UI perfecta antes de tener flujo funcional. Subestimar complejidad de permisos.
- **Criterio de salida:** El equipo puede hacer una demo completa del flujo de consulta sin errores. Se puede crear un paciente, agendar una cita, documentar una consulta y ver el historial.

### Fase 2: Piloto en Clínica Real (Semanas 9-12)

- **Objetivo:** Poner el sistema en uso real con una clínica piloto y recoger feedback.
- **Entregables:**
  - Despliegue en producción con HTTPS, backups y monitoreo.
  - Onboarding de la clínica: configuración, creación de usuarios, carga de pacientes existentes.
  - Capacitación del personal.
  - Recolección de feedback semanal.
  - Corrección de bugs y ajustes de UX.
- **Riesgos:** La clínica piloto no adopta el sistema. Problemas de rendimiento o estabilidad. La conexión a internet de la clínica es mala.
- **Criterio de salida:** La clínica usa el sistema diariamente durante al menos 3 semanas. El médico documenta consultas reales. No hay pérdida de datos. El feedback es procesable (no "tíralo a la basura").

### Fase 3: Versión Vendible (Semanas 13-20)

- **Objetivo:** Convertir el piloto en un producto que se pueda vender a otras clínicas.
- **Entregables:**
  - Correcciones y mejoras del piloto implementadas.
  - Landing page / sitio web del producto.
  - Proceso de onboarding documentado y repetible.
  - Pricing definido.
  - Multi-tenancy probado (al menos 2 clínicas en producción).
  - Términos de servicio y política de privacidad.
  - Material de venta básico.
- **Riesgos:** No encontrar más clínicas dispuestas a pagar. Intentar agregar demasiadas features antes de vender.
- **Criterio de salida:** Al menos 3 clínicas usando el sistema. Al menos 1 pagando (aunque sea precio de early adopter). Proceso de onboarding toma menos de 3 días.

---

## SECCIÓN 12 — PLAN DE TRABAJO PARA EQUIPO DE 3

### Distribución de roles

| Rol | Persona | Responsabilidades principales |
|---|---|---|
| **Producto + Negocio + Frontend** | Persona A | Discovery, entrevistas con médicos, diseño UX/UI, frontend, landing page, pricing, ventas. |
| **Backend + Datos + Seguridad** | Persona B | API, base de datos, autenticación, permisos, auditoría, backups, despliegue. |
| **Full-stack + QA + Ops** | Persona C | Apoya en frontend y backend según necesidad. Testing. CI/CD. Documentación técnica. Monitoreo. |

**NOTA:** En un equipo de 3, todos tocan todo. Los roles son de responsabilidad primaria, no de exclusividad.

### Dinámica semanal (8 semanas de construcción)

**Lunes:** Planning de la semana (30 min). Definir 3-5 tareas por persona. Priorizar lo que desbloquea al otro.

**Martes a Jueves:** Ejecución. Comunicación asíncrona por chat del equipo. Si alguien se bloquea, lo dice inmediatamente — no espera al viernes.

**Viernes:** Demo interna (30 min). Cada uno muestra lo que construyó. Se prueba el flujo integrado. Se identifican bugs. Se ajusta el plan de la próxima semana.

### Cronograma de 8 semanas (Fase 1: MVP)

| Semana | Persona A (Producto/Frontend) | Persona B (Backend/Datos) | Persona C (Full-stack/QA) |
|---|---|---|---|
| 1 | Mockups finales de pantallas principales. Setup del proyecto frontend. | Setup del proyecto backend. Modelo de datos. Migraciones. Auth (registro, login, JWT). | Setup CI/CD. Ambiente de staging. Boilerplate de tests. |
| 2 | Pantallas: Login, Dashboard, Lista de pacientes. | API: CRUD pacientes. API: CRUD usuarios. Middleware de permisos. | Tests de auth y permisos. Revisión de seguridad del setup. |
| 3 | Pantalla: Ficha de paciente (datos + antecedentes). | API: Historia clínica (MedicalHistory). Endpoint de antecedentes ginecológicos. | Tests de API de pacientes. Ayudar con formularios complejos en frontend. |
| 4 | Pantallas: Agenda (vista diaria, crear/editar cita). | API: CRUD citas. Lógica de estados de cita. | Tests de agenda. Integración frontend-backend de citas. |
| 5 | Pantallas: Nota de evolución (formulario SOAP + texto libre). | API: CRUD notas clínicas. Lógica de firma (inmutabilidad). Specialty_data schema. | Tests de notas. Revisar flujo completo hasta aquí. |
| 6 | Pantalla: Carga y vista de adjuntos. Vista resumen de paciente (timeline). | API: Upload/download de adjuntos. Storage seguro. AuditLog implementación. | Tests de adjuntos y auditoría. Revisar permisos end-to-end. |
| 7 | Pulir UX. Responsive. Dashboard con contadores. Búsqueda de pacientes. | Optimizar queries. Revisar índices. Endpoint de búsqueda. | Testing integral del flujo completo. Documentar bugs. |
| 8 | Fix de UX por feedback interno. Preparar demo. | Fix de bugs. Backups automatizados. Preparar producción. | Test final. Checklist de seguridad. Documentar despliegue. |

---

## SECCIÓN 13 — STACK TECNOLÓGICO RECOMENDADO

### Nota crítica sobre versiones de Next.js

**NO usar Next.js 14 ni versiones anteriores a 15.2.3.** Next.js 14 acumuló múltiples vulnerabilidades críticas:

- **CVE-2025-29927** (marzo 2025): Bypass completo de autenticación en middleware. Un solo header HTTP (`x-middleware-subrequest`) saltaba todas las verificaciones de seguridad. Afecta todas las versiones 14.x anteriores a 14.2.25. Para software médico, esto es inaceptable.
- **CVE-2025-66478 — "React2Shell"** (diciembre 2025): Ejecución remota de código (CVSS 10.0) en React Server Components. Afecta Next.js 15.x y 16.x — parcheado en 16.0.10+.
- **CVE-2025-55184** (diciembre 2025): Denegación de servicio en App Router, cuelga el servidor con una sola request.
- **CVE-2025-55183** (diciembre 2025): Exposición de código fuente de Server Actions.

**La versión estable actual es Next.js 16.2** (marzo 2026). Es la que se debe usar.

### Opción A: Next.js 16 Full-stack (Recomendada)

| Capa | Tecnología | Versión mínima | Justificación |
|---|---|---|---|
| **Frontend + Backend** | Next.js 16.2 (App Router) + TypeScript + TailwindCSS v4 | `next@16.2.x` | Un solo lenguaje (TS) para todo. Server Components + Server Actions. React 19.2 integrado. Turbopack estable con ~400% más rápido en dev. El equipo ya tiene experiencia con Next.js. |
| **Runtime** | React 19.2 | `react@19.2.x` | Incluido con Next.js 16. View Transitions, Activity API. Parcheado contra React2Shell. |
| **Base de datos** | PostgreSQL 16+ | 16.x | JSONB para specialty_data. Robusto, escalable, gratis. El estándar para datos médicos. |
| **ORM** | Drizzle ORM | `drizzle-orm@latest` | Superó a Prisma en adopción en 2025. Más ligero (~5KB vs ~40KB), SQL-first, zero engine layer, type-safe. PlanetScale adquirió al equipo core de Drizzle en marzo 2026 — señal fuerte de estabilidad a largo plazo. Mejor para VPS: sin binarios, setup simple. |
| **Auth** | Auth.js v5 (NextAuth) o implementación propia con JWT | `next-auth@5.x` | Auth.js v5 rediseñado para App Router. Para el MVP con credentials-only, JWT propio con argon2id también funciona y da más control. |
| **Validación** | Zod | `zod@latest` | Validación de schemas compartida entre frontend y backend. Integración nativa con Server Actions y Drizzle. |
| **Storage de archivos** | Cloudflare R2 o Backblaze B2 | — | Compatibles con API de S3. R2 no cobra egress. B2 es el más barato para LATAM. MinIO si quieren self-hosted. |
| **Despliegue** | VPS (Hetzner, DigitalOcean) con Docker Compose | — | Control total. Más barato que Vercel para producción con DB. Un solo servidor para el MVP. |

**Trade-offs:**
- (+) Un solo lenguaje, un solo repo, productividad alta.
- (+) El equipo ya conoce Next.js.
- (+) Next.js 16 resuelve los problemas de caching implícito de versiones anteriores — ahora todo es opt-in con `"use cache"`.
- (+) Drizzle es SQL transparente: ves exactamente qué query se ejecuta, crítico para datos médicos donde necesitas control.
- (-) Las Server Actions / Route Handlers de Next.js no son tan ergonómicas como un framework backend dedicado para APIs muy complejas.
- (-) Si el backend crece mucho, puede ser necesario extraerlo (pero para el MVP esto no importa).

### Opción B: Frontend separado + Backend Python

| Capa | Tecnología | Versión mínima | Justificación |
|---|---|---|---|
| **Frontend** | Next.js 16.2 + TailwindCSS v4 | `next@16.2.x` | SSR + React 19.2. |
| **Backend** | FastAPI (Python) | `fastapi@latest` | Rápido, moderno, tipado, excelente documentación automática (OpenAPI). |
| **Base de datos** | PostgreSQL 16+ | 16.x | Igual que Opción A. |
| **ORM** | SQLAlchemy 2.x | `sqlalchemy@2.x` | Maduro. El estándar en Python. Soporte async. |
| **Auth** | JWT propio con FastAPI | — | FastAPI tiene excelente soporte para auth. |
| **Storage** | Igual que Opción A. | — | |
| **Despliegue** | VPS con Docker Compose (2 contenedores: front + back) | — | |

**Trade-offs:**
- (+) FastAPI es excelente para APIs REST. Documentación automática con Swagger.
- (+) Python tiene más librerías para procesamiento de datos médicos si se necesita después.
- (-) Dos lenguajes, dos repos (o monorepo más complejo), más overhead de coordinación.
- (-) El equipo ya demostró productividad con Next.js + TypeScript (Nodeaway fue full Next.js + TS).

### Recomendación

**Opción A (Next.js 16 full-stack con Drizzle ORM)** para el MVP. Razones:

1. El equipo ya tiene experiencia demostrada con Next.js + TypeScript.
2. Un solo lenguaje reduce fricción y bugs de integración.
3. Drizzle es la opción más alineada en 2026: ligero, SQL-transparente, respaldado por PlanetScale, sin binarios que compliquen Docker.
4. Next.js 16 corrigió los problemas más criticados de versiones anteriores (caching implícito, middleware inseguro).
5. Si después se necesita separar el backend, se pueden extraer las route handlers a un servicio independiente.

### Stack complementario (versiones actualizadas a abril 2026)

| Necesidad | Herramienta | Notas |
|---|---|---|
| Base de datos (desarrollo) | PostgreSQL 16 con Docker | `postgres:16-alpine` |
| ORM + Migraciones | Drizzle ORM + Drizzle Kit | Schema en TypeScript, migraciones SQL explícitas. `drizzle-kit generate` + `drizzle-kit migrate`. |
| Validación de datos | Zod | Schemas compartidos front/back. Integra con Drizzle y Server Actions. |
| UI Components | shadcn/ui | Compatible con TailwindCSS v4. Componentes copiables, no dependencia. |
| Styling | TailwindCSS v4 | Nuevo engine, más rápido. Configuración simplificada vs v3. |
| Testing | Vitest + Playwright (e2e) | Vitest para unit/integration. Playwright para flujos críticos end-to-end. |
| CI/CD | GitHub Actions | Build, test, deploy a VPS con Docker. |
| Monitoreo básico | Better Stack (Uptime) o UptimeRobot + logs del servidor | Health checks + alertas. |
| Email transaccional (post-MVP) | Resend | API moderna, buen free tier, SDK para TypeScript. |
| Linting | ESLint + eslint-config-next + Prettier | Configuración estándar de Next.js 16. |

---

## SECCIÓN 14 — RIESGOS Y DECISIONES DIFÍCILES

### 1. Plantilla fija vs. formularios flexibles

**Recomendación: Plantilla semi-fija con extensión vía JSONB.**

El MVP tiene una plantilla de ginecología/fertilidad con campos definidos. El campo `specialty_data` (JSONB) permite agregar campos sin migrar la BD. No construir un form builder genérico — eso es un producto en sí mismo. Si más adelante se necesita multi-especialidad, se agregan más schemas de speciality_data con sus formularios correspondientes en el frontend.

**Razonamiento:** Un form builder genérico triplica el tiempo de desarrollo y produce peor UX que un formulario diseñado para la especialidad.

### 2. Texto libre vs. estructura

**Recomendación: Ambos. Estructura sugerida (SOAP) + texto libre siempre disponible.**

Los médicos tienen estilos muy diferentes. Algunos quieren campos estructurados, otros quieren escribir un párrafo. El sistema sugiere la estructura SOAP (Subjetivo, Objetivo, Assessment, Plan) pero cada campo es un textarea libre. No forzar campos obligatorios en la nota clínica (excepto la fecha).

**Razonamiento:** Si el sistema es más lento que escribir en un cuaderno, el médico no lo adopta. La estructura rígida mata la adopción.

### 3. Multi-especialidad vs. nicho único

**Recomendación: Nicho único en producto, multi-especialidad en arquitectura.**

El producto se vende como solución para ginecología/fertilidad. Pero la base de datos y el backend usan `specialty_data` (JSONB) que acepta cualquier schema. Esto permite agregar especialidades después sin reescribir.

**Razonamiento:** Vender nicho genera confianza ("estos entienden mi especialidad"). Arquitectura flexible permite pivotar si el nicho no funciona.

### 4. Nube vs. local/híbrido

**Recomendación: Nube desde el inicio. Modelo SaaS puro.**

Ventajas: backups automáticos, acceso desde cualquier lugar, actualizaciones centralizadas, monitoreo. Si una clínica insiste en local, se evalúa como caso excepcional (no como modelo de negocio).

**Razonamiento:** El modelo local multiplica el soporte técnico por N clínicas. Con un equipo de 3, no es viable. Además, "acceder desde cualquier lugar" es un diferenciador vs. software de escritorio viejo.

**Riesgo:** Clínicas con internet malo. Mitigación: el sistema debe funcionar con conexiones lentas (no cargar assets pesados innecesariamente). Considerar PWA con cache offline para lectura en post-MVP.

### 5. Archivos sensibles

**Recomendación: Archivos servidos a través del backend, nunca URLs directas al storage.**

El usuario sube un archivo → se almacena en S3/R2 con nombre UUID (no el nombre original) → se sirve a través de un endpoint autenticado del backend que verifica permisos antes de generar una URL temporal o hacer streaming.

**Razonamiento:** Si los archivos son accesibles por URL directa, cualquier persona con el link puede descargarlos. Inaceptable para datos médicos.

### 6. Migración desde sistemas viejos

**Recomendación: No incluir migración automática en el MVP. Ofrecer importación de pacientes por CSV.**

La migración desde software viejo o Excel es un problema real, pero cada clínica tiene datos en formato diferente. Un importador genérico es un sumidero de tiempo. Para el MVP: importar lista de pacientes (nombre, cédula, teléfono, fecha de nacimiento) por CSV. La historia clínica antigua se puede escanear y subir como adjunto PDF.

**Razonamiento:** El 80% del valor está en que las nuevas consultas se documenten bien. La historia antigua se puede consultar en el adjunto escaneado mientras se va poblando el sistema con cada visita.

---

## SECCIÓN 15 — PREGUNTAS CRÍTICAS POR RESPONDER

Estas preguntas deben responderse con médicos y personal administrativo ANTES de construir:

### Sobre el flujo clínico

1. ¿Cuántos pacientes atiende el médico por día en promedio?
2. ¿Cuánto dura una consulta típica?
3. ¿Qué información consulta el médico siempre antes de atender a una paciente?
4. ¿Cómo documenta hoy la consulta? ¿Escribe durante la consulta o después?
5. ¿Usa algún formato estándar (SOAP, narrativo, plantilla propia)?
6. ¿Qué tipos de resultados recibe y necesita archivar? (laboratorio, eco, imágenes, informes de otros médicos)
7. ¿Necesita ver resultados previos durante la consulta?
8. ¿Qué indicaciones da al paciente al final de la consulta? ¿Las imprime?

### Sobre la especialidad

9. ¿Cuáles son los datos ginecológicos/de fertilidad que siempre registra?
10. ¿Sigue protocolos de fertilidad que requieran seguimiento en el tiempo (ciclos, medicación, ecografías por fecha)?
11. ¿Necesita registrar signos vitales o medidas específicas (peso, IMC, presión arterial)?
12. ¿Trabaja con otros especialistas del mismo consultorio? ¿Necesitan compartir la ficha?

### Sobre administración

13. ¿Cómo gestiona la agenda hoy? ¿Quién la maneja?
14. ¿Cuántas personas del staff necesitarían acceso al sistema?
15. ¿Tiene algún sistema actual (aunque sea Excel) del que necesite migrar datos?
16. ¿Cómo maneja los cobros? ¿Necesita que el sistema se integre con facturación o solo registra que se cobró?

### Sobre tecnología y adopción

17. ¿Qué dispositivos usan en el consultorio? (PC escritorio, laptop, tablet, celular)
18. ¿Cómo es la calidad de internet en el consultorio?
19. ¿Ha intentado usar algún software médico antes? ¿Qué pasó?
20. ¿Cuánto pagaría al mes por un sistema que le resuelva esto?
21. ¿Qué haría que deje de usar el sistema después de empezar?

### Sobre seguridad y legal

22. ¿Tiene algún requisito legal o gremial sobre cómo almacenar historias clínicas?
23. ¿Sus pacientes preguntan por la privacidad de sus datos?
24. ¿Necesita generar informes para aseguradoras u otros entes?

---

## SECCIÓN 16 — MEGAPROMPT FUNDADOR

El siguiente prompt está diseñado para ser utilizado con un modelo de IA para iterar sobre el producto, generar PRDs, definir arquitectura, o producir cualquier documento técnico o de producto derivado.

---

```
Actúa como Head of Product + Solutions Architect para un producto de software médico. Tu contexto es el siguiente:

## PRODUCTO
Nombre de trabajo: ClínicaMVP (nombre temporal).
Tipo: Historia Clínica Electrónica (HCE/EHR) para consultorios privados especializados.
Nicho inicial: Ginecología y medicina reproductiva (fertilidad).
Mercado inicial: Clínicas privadas en Venezuela. Expansión futura: LATAM.
Modelo de negocio: SaaS mensual. Precio estimado: $50-150 USD/mes por consultorio.

## EQUIPO
3 personas. Stack: Next.js 16.2 (App Router, full-stack) + TypeScript + PostgreSQL + TailwindCSS v4 + Drizzle ORM.
Experiencia previa del equipo: Next.js, FastAPI, despliegue en VPS, n8n, CI/CD con Docker.
IMPORTANTE: No usar Next.js 14 ni versiones anteriores a 15.2.3 por vulnerabilidades críticas (CVE-2025-29927, CVE-2025-66478 React2Shell). Siempre usar la última versión parcheada de Next.js 16.x.

## MVP — QUÉ INCLUYE
1. Registro y búsqueda de pacientes (datos demográficos + identificación).
2. Agenda de citas simple (diaria/semanal, estados: agendada, en espera, atendida, cancelada, no asistió).
3. Historia clínica con antecedentes (personales, familiares, quirúrgicos, alérgicos) + antecedentes ginecológicos/obstétricos en campo JSONB extensible (specialty_data).
4. Notas de evolución por consulta (formato SOAP sugerido, texto libre permitido, campos specialty_data por tipo de consulta).
5. Adjuntos (PDF, imágenes) asociados a paciente y/o consulta. Servidos por backend autenticado, nunca por URL directa.
6. Usuarios y roles (admin, médico, recepcionista). Permisos verificados en cada endpoint.
7. Auditoría append-only (quién, qué, cuándo, sobre qué recurso).
8. Dashboard mínimo con contadores (pacientes, consultas, citas del día).
9. Importación de pacientes por CSV.

## MVP — QUÉ NO INCLUYE
Facturación, prescripción electrónica con catálogo, telemedicina, portal del paciente, notificaciones automáticas, integración con laboratorios, inventario, multi-idioma, app nativa.

## ARQUITECTURA Y DATOS
- Multitenancy lógica: toda tabla tiene clinic_id. Todo query filtra por clinic_id.
- PostgreSQL con JSONB para specialty_data (antecedentes y notas por especialidad).
- Auth: email + contraseña (argon2id hash). JWT access token (15 min) + refresh token con rotación.
- Archivos en S3-compatible (Cloudflare R2 o Backblaze B2). Nombre UUID en storage, servidos por backend.
- Despliegue: VPS con Docker Compose. CI/CD con GitHub Actions.

## SEGURIDAD (IMPRESCINDIBLE EN MVP)
- HTTPS obligatorio.
- Hash fuerte (argon2id).
- JWT con expiración corta + refresh.
- Roles verificados en backend en cada request.
- Aislamiento por clinic_id.
- Audit log append-only.
- Rate limiting en login.
- Validación de entrada en backend.
- CORS restringido.
- Cookies HttpOnly + Secure + SameSite.
- Notas clínicas firmadas son inmutables.

## PERSONAS
- Médico: abre ficha, ve historial, escribe evolución, adjunta resultados, agenda siguiente cita. No tolera lentitud.
- Recepcionista: agenda citas, registra pacientes, busca fichas, marca asistencia. Nivel técnico bajo.
- Admin: gestiona usuarios, revisa auditoría, configura consultorio.

## FLUJO CRÍTICO (debe funcionar perfecto)
Agendar cita → Paciente llega → Marcar asistencia → Médico abre ficha → Ve historial → Escribe nota → Adjunta resultado → Agenda próxima cita → Todo en < 3 minutos de interacción con sistema.

## RESTRICCIONES
- No crear form builder genérico.
- No crear módulo de facturación.
- No crear visor DICOM.
- No crear agenda multi-recurso (MVP: 1 médico = 1 agenda).
- Diseño responsive web-first, no app nativa.
- Español únicamente en MVP.

## RIESGOS CLAVE
- Adopción: el médico debe encontrar el sistema más rápido que el papel.
- Internet: la conexión puede ser inestable. UI debe ser ligera.
- Privacidad: datos médicos son altamente sensibles. Diseñar con estándares altos independientemente de regulación local.
- Scope creep: el mayor riesgo del equipo es querer agregar features antes de validar.

## FORMATO DE SALIDA
Cuando te pida documentos, entrega en formato estructurado con secciones claras, tablas cuando mejoren la claridad, y decisiones argumentadas con trade-offs. Siempre distingue entre lo que entra al MVP y lo que viene después. Si faltan datos, indica qué preguntas hay que resolver con los usuarios antes de avanzar.
```

---

## APÉNDICE

### A. Funcionalidades "Nice to Have" (post-MVP, priorizadas)

| Prioridad | Funcionalidad | Por qué espera |
|---|---|---|
| P1 | Recordatorios de cita por WhatsApp/SMS | Alto valor pero requiere integración externa y costo operativo. |
| P1 | Exportar historial del paciente a PDF | Muy pedido por médicos para referir pacientes. Diseñar el modelo de datos para que sea posible. |
| P1 | Plantillas de notas clínicas por tipo de consulta | Ahorra tiempo al médico. Requiere definir tipos de consulta con el nicho. |
| P2 | Consentimiento informado digital | Valor legal. Requiere flujo de firma. |
| P2 | Prescripción con catálogo de medicamentos | Requiere mantener un catálogo actualizado. |
| P2 | Multi-sede | La arquitectura ya lo soporta (clinic_id). Requiere UI de selección de sede y permisos por sede. |
| P2 | Reportes avanzados y estadísticas | Consultas por médico, pacientes nuevos por mes, diagnósticos frecuentes. |
| P3 | Portal del paciente | Acceso a próximas citas y resultados. Requiere auth separada. |
| P3 | Telemedicina (videollamada) | Fuera del core. Mejor integrar con herramienta existente. |
| P3 | Integración con laboratorios (HL7/FHIR) | Altísima complejidad. Solo cuando haya demanda clara. |
| P3 | App móvil nativa | La PWA debería cubrir el 90% de los casos. |

### B. Errores típicos al construir software médico pequeño

1. **Intentar ser genérico desde el inicio.** "Funciona para cualquier especialidad" = no funciona bien para ninguna. Empezar vertical.
2. **Subestimar la UX del médico.** Si el médico tarda 5 clics en hacer lo que hacía en 10 segundos con papel, el sistema fracasa.
3. **Construir facturación "básica".** La facturación tiene requisitos fiscales, legales y contables que no son "básicos" en ningún país.
4. **Ignorar la auditoría desde el inicio.** Agregar auditoría después es doloroso y deja huecos.
5. **No probar con datos reales.** Una demo con 3 pacientes de prueba no revela los problemas que aparecen con 500.
6. **No involucrar al personal administrativo en el diseño.** La recepcionista usa el sistema más que el médico. Si ella no lo adopta, nadie lo adopta.
7. **Over-engineering del modelo de datos.** Normalizar todo hasta la quinta forma normal genera queries horribles y lentitud de desarrollo.
8. **No tener backup probado.** Tener backup configurado no es lo mismo que haber verificado que se puede restaurar.
9. **Olvidar que los médicos no leen manuales.** Si necesita manual, necesita rediseño.
10. **Prometer "se implementa en un día".** El onboarding realista de una clínica (capacitación, configuración, carga de pacientes) toma 2-5 días.
11. **No definir qué pasa cuando se firma una nota.** Las notas firmadas deben ser inmutables. Las correcciones se hacen con addendas. Esto es importante legal y éticamente.
12. **Almacenar archivos médicos en rutas predecibles o URLs públicas.** Toda imagen, PDF o resultado debe estar detrás de autenticación.

### C. Entrevistas recomendadas para Discovery

| # | Persona | Objetivo | Preguntas clave |
|---|---|---|---|
| 1 | Ginecólogo/a con consultorio privado | Entender flujo de consulta real y dolores actuales | ¿Cómo documenta hoy? ¿Qué info necesita ver antes de cada paciente? ¿Qué le frustra? |
| 2 | Especialista en fertilidad | Entender complejidad de seguimiento de tratamientos | ¿Cómo hace seguimiento de ciclos? ¿Cuántas visitas tiene un paciente promedio? ¿Qué datos necesita siempre? |
| 3 | Recepcionista de consultorio | Entender flujo operativo y cuellos de botella | ¿Cómo maneja la agenda? ¿Cuánto tiempo pierde buscando fichas? ¿Qué errores son más comunes? |
| 4 | Dueño/admin de clínica pequeña | Entender preocupaciones de negocio y disposición a pagar | ¿Cuánto paga hoy por software? ¿Qué le preocupa de seguridad? ¿Cuánto pagaría por una solución? |
| 5 | Médico que ya usó software médico y lo abandonó | Entender causas de fracaso de adopción | ¿Qué software usó? ¿Por qué lo dejó? ¿Qué haría diferente? |
| 6 | Paciente de consultorio de fertilidad | Entender expectativas del paciente (para fase futura) | ¿Le gustaría ver sus resultados en línea? ¿Cómo se comunica con el consultorio? |

### D. Checklist de validación antes de programar

Antes de escribir la primera línea de código de producción, verificar:

- [ ] Se entrevistó al menos a 3 personas del consultorio objetivo (médico, recepcionista, admin).
- [ ] El flujo de consulta documentado fue validado por un médico real.
- [ ] Hay al menos 1 clínica comprometida como piloto.
- [ ] Los mockups de las 5 pantallas principales fueron revisados por un usuario real.
- [ ] El modelo de datos fue revisado con datos reales de ejemplo (no inventados).
- [ ] Se definió dónde se despliega y con qué proveedor.
- [ ] Se configuró HTTPS y un dominio (aunque sea de staging).
- [ ] Se tiene un contrato o acuerdo básico con la clínica piloto (sobre datos, privacidad, expectativas).
- [ ] Se definió el pricing inicial (aunque sea estimado).
- [ ] Se tiene claro qué NO se va a construir en los primeros 2 meses.
- [ ] Se tiene un canal de comunicación directa con el usuario piloto para feedback semanal.
- [ ] Se definió un backup strategy y se probó la restauración al menos una vez.

---

**FIN DEL DOCUMENTO FUNDACIONAL**

*Este documento debe revisarse y actualizarse después de cada fase. Los supuestos marcados deben validarse con usuarios reales antes de comprometer decisiones de implementación.*
