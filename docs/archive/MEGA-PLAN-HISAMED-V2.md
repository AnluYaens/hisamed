> ✅ COMPLETED — historical record of v2 expansion plan, all phases shipped.

# MEGA PLAN — Hisamed v2: De MVP a Producto Vendible

> Plan completo para convertir Hisamed en un reemplazo superior de HipoSEMG.
> Cada fase es un prompt para el agente. No pegar el siguiente hasta que el actual
> compile y funcione. Después de cada fase: probar, commitear, redeploy.

---

## Estado actual (lo que ya tenemos)

- ✅ Auth con JWT + roles (admin, doctor, receptionist)
- ✅ Pacientes CRUD con búsqueda
- ✅ Historia clínica con specialty_data ginecología
- ✅ Agenda de citas
- ✅ Notas de evolución SOAP con firma inmutable
- ✅ Adjuntos (PDF, imágenes)
- ✅ Foto del paciente (avatar)
- ✅ Documentos clínicos (reposo, constancia, referencia, receta, indicaciones)
- ✅ Autocompletado con frases frecuentes
- ✅ Auditoría
- ✅ Import CSV
- ✅ Deploy en producción (Supabase + R2 + DigitalOcean + Caddy)

---

## FASE 1 — Datos ampliados del paciente y pareja
**Objetivo:** Que el registro del paciente capture todo lo que el ginecólogo necesita desde la primera consulta.
**Modelo:** Sonnet 4.6 · Effort: high

```
Lee CLAUDE.md y el schema actual en src/lib/db/schema.ts (tabla patients y medical_histories).

El ginecólogo necesita datos adicionales del paciente y de su pareja. Implementa:

1. NUEVOS CAMPOS EN PATIENTS (migración):
   - blood_type (enum: 'A+','A-','B+','B-','AB+','AB-','O+','O-', nullable)
   - rh_incompatibility (boolean, default false)
   - instagram (varchar 100, nullable)
   - referral_source (varchar 255, nullable) — "cómo se enteró / quién lo recomendó"
   - occupation (varchar 255, nullable)

2. NUEVA TABLA "patient_partners" (1:1 con patient):
   - id (UUID PK)
   - patient_id (FK patients, UNIQUE)
   - full_name (varchar 255, NOT NULL)
   - id_number (varchar 50, nullable)
   - date_of_birth (date, nullable)
   - phone (varchar 50, nullable)
   - email (varchar 255, nullable)
   - blood_type (mismo enum)
   - occupation (varchar 255, nullable)
   - notes (text, nullable)
   - avatar_storage_key (varchar 500, nullable)
   - created_at, updated_at

3. FORMULARIO DE PACIENTE:
   - Agregar los campos nuevos al formulario de registro/edición.
   - Nueva sección/tab "Pareja" en la ficha del paciente con formulario de
     datos de la pareja + foto de la pareja.
   - El campo blood_type debe ser un select, no texto libre.
   - referral_source: campo de texto con placeholder "Ej: Instagram, 
     recomendación de Dra. García, Google..."

4. ALERTA DE ALERGIAS:
   - En la ficha del paciente (/pacientes/[id]), si medical_history.allergies
     no es null ni vacío, mostrar un banner rojo fijo en la parte superior:
     "⚠️ ALERGIAS: [contenido del campo]"
   - Este banner también debe aparecer en:
     - La página de nueva nota de evolución
     - La página de nuevo documento clínico (receta, etc.)
   - Si no hay alergias, no mostrar nada.

5. ALERTA DE GRUPO SANGUÍNEO / Rh:
   - Si rh_incompatibility es true, mostrar badge amarillo:
     "⚠️ Incompatibilidad Rh"
   - Visible en la ficha del paciente junto al grupo sanguíneo.

6. Generar migración, actualizar validadores Zod, actualizar queries,
   actualizar server actions. Audit log para cambios en pareja.

7. Permisos: todos pueden ver datos demográficos y de la pareja.
   Solo admin/doctor pueden ver/editar historia clínica (ya existente).
```

---

## FASE 2 — Signos vitales por consulta
**Objetivo:** Registrar signos vitales en cada visita y poder ver la evolución en el tiempo.
**Modelo:** Sonnet 4.6 · Effort: high

```
Lee CLAUDE.md y el schema actual.

Los signos vitales se toman al inicio de cada consulta. Implementa:

1. NUEVA TABLA "vital_signs":
   - id (UUID PK)
   - clinic_id (FK clinics)
   - patient_id (FK patients)
   - clinical_note_id (FK clinical_notes, nullable — asociable a una consulta)
   - recorded_by (FK users)
   - recorded_at (timestamp, NOT NULL, default now())
   - weight_kg (decimal 5,2, nullable)
   - height_cm (decimal 5,1, nullable)
   - bmi (decimal 4,1, nullable) — calculado automáticamente
   - systolic_bp (integer, nullable) — tensión arterial sistólica
   - diastolic_bp (integer, nullable) — tensión arterial diastólica
   - heart_rate (integer, nullable) — frecuencia cardíaca
   - respiratory_rate (integer, nullable) — frecuencia respiratoria
   - temperature_c (decimal 4,1, nullable) — temperatura en Celsius
   - oxygen_saturation (integer, nullable) — SpO2 %
   - notes (text, nullable)
   - created_at

2. COMPONENTE VitalSignsForm:
   - Formulario compacto en una sola fila o grid 2x4.
   - IMC se calcula automáticamente al llenar peso y talla.
   - Campos numéricos con unidades visibles (kg, cm, mmHg, lpm, °C, %).
   - Validación de rangos razonables (ej: peso 20-300kg, TA 60-250, etc.).
   - Alertas visuales si un valor está fuera de rango normal:
     - TA sistólica > 140 o < 90: amarillo
     - TA sistólica > 180 o < 70: rojo
     - FC > 100 o < 50: amarillo
     - SpO2 < 95: amarillo, < 90: rojo
     - Temperatura > 38: amarillo, > 39: rojo

3. INTEGRACIÓN:
   - En la página de nueva nota de evolución (/pacientes/[id]/notas/nueva),
     agregar el bloque de signos vitales ARRIBA del formulario SOAP.
   - Los signos vitales se guardan como un registro separado (tabla vital_signs)
     asociado a la nota clínica.
   - Si la recepcionista/asistente toma los signos antes de que el doctor
     atienda, debe poder registrarlos sin crear una nota clínica
     (clinical_note_id = null). Después el doctor los asocia.
   - En la ficha del paciente, nueva sección "Signos vitales" que muestre
     los últimos registrados y un mini historial.

4. GRÁFICOS DE EVOLUCIÓN:
   - En la ficha del paciente, tab o sección "Evolución" con gráficos de línea:
     - Peso (kg) vs tiempo
     - TA (sistólica/diastólica) vs tiempo
     - IMC vs tiempo
   - Usar recharts (ya disponible como dependencia de shadcn).
   - Solo mostrar gráfico si hay 2+ registros.

5. Server Action createVitalSigns:
   - Todos los roles pueden registrar (la recepcionista/asistente toma signos).
   - Verificar clinic_id.
   - Calcular IMC automáticamente si vienen peso y talla.
   - Audit log CREATE.

6. Migración + validators + queries.
```

---

## FASE 3 — CIE-10 con buscador inteligente
**Objetivo:** Diagnósticos profesionales y estandarizados con búsqueda rápida.
**Modelo:** Sonnet 4.6 · Effort: high

```
Lee CLAUDE.md y el formulario de notas clínicas actual.

Reemplaza el campo de diagnóstico de texto libre por un buscador de CIE-10.

1. BASE DE DATOS CIE-10:
   - Descarga el catálogo CIE-10 en español (versión OMS).
     URL: busca en la web un JSON o CSV del CIE-10 en español.
   - Crea un archivo src/lib/data/cie10.json con la estructura:
     [{ "code": "E11", "description": "Diabetes mellitus tipo 2" }, ...]
   - Incluye al menos los capítulos más usados en ginecología:
     O00-O99 (Embarazo, parto y puerperio)
     N00-N99 (Enfermedades del aparato genitourinario)
     C00-D49 (Neoplasias)
     E00-E89 (Enfermedades endocrinas)
     Z00-Z99 (Factores que influyen en el estado de salud)
   - Si el JSON completo es muy grande (>2MB), incluye solo estos capítulos.

2. COMPONENTE Cie10Combobox:
   - Input de búsqueda con debounce 200ms.
   - Busca por código O por descripción (ILIKE).
   - Muestra resultados en un dropdown: "E11 — Diabetes mellitus tipo 2".
   - Al seleccionar, llena diagnosis_code Y diagnosis_text automáticamente.
   - El médico puede seguir editando diagnosis_text después de seleccionar
     (para agregar detalles como "tipo 2, controlada con Metformina").
   - Permite múltiples diagnósticos: el médico puede agregar 2-3.
   - Si el médico no encuentra el código, puede escribir texto libre (no forzar CIE-10).

3. INTEGRACIÓN:
   - Reemplazar los campos diagnosis_text y diagnosis_code en
     clinical-note-form.tsx por el Cie10Combobox.
   - En los documentos clínicos (receta, reposo, etc.), el campo de
     diagnóstico también usa el Cie10Combobox.
   - En la vista de nota clínica (lectura), mostrar el código CIE-10
     como badge junto al diagnóstico: [N76.0] Vaginitis aguda

4. MÚLTIPLES DIAGNÓSTICOS:
   - Cambiar el modelo: en clinical_notes, reemplazar diagnosis_text (string)
     y diagnosis_code (string) por diagnoses (JSONB array):
     [{ "code": "N76.0", "text": "Vaginitis aguda" },
      { "code": "E11", "text": "Diabetes tipo 2 controlada" }]
   - O crear una tabla clinical_note_diagnoses si prefieres relacional.
   - JSONB es más simple y suficiente.

5. Migración de datos existentes:
   - Si hay notas con diagnosis_text/diagnosis_code, migrarlas al nuevo
     formato JSONB como [{ code: old_code, text: old_text }].
```

---

## FASE 4 — Examen ginecológico estructurado
**Objetivo:** Plantilla específica para el examen ginecológico que el doctor llena en cada consulta.
**Modelo:** Opus 4.7 · Effort: high

```
Lee CLAUDE.md y el formulario de notas clínicas actual.

El ginecólogo necesita una sección estructurada de examen ginecológico dentro
de la nota de evolución. No es texto libre — son campos específicos.

1. SECCIÓN "EXAMEN GINECOLÓGICO" en la nota de evolución:
   Agregar como sección colapsable DESPUÉS del bloque SOAP (o integrada en "Objetivo"):

   a) Examen externo:
      - Labios mayores: select (normal, edema, lesiones, otro) + texto libre
      - Labios menores: select (normal, adherencias, lesiones, otro) + texto libre
      - Vulva: select (normal, leucoplasia, condilomas, otro) + texto libre
      - Región perineal: select (normal, desgarros, cicatrices, otro) + texto libre

   b) Examen con espéculo:
      - Vagina: select (normal, leucorrea, lesiones, otro) + texto libre
      - Cuello uterino: select (normal, ectropión, pólipo, lesión sospechosa, otro) + texto libre
      - Secreción: select (sin secreción, blanca, amarilla, verdosa, sanguinolenta) + texto libre

   c) Tacto bimanual:
      - Útero: tamaño (select: normal, aumentado, disminuido), posición (AVF, RVF, lateral), consistencia, movilidad, dolor
      - Anexo derecho: select (normal, masa palpable, dolor) + texto libre
      - Anexo izquierdo: select (normal, masa palpable, dolor) + texto libre
      - Fondo de saco de Douglas: select (libre, abombado, doloroso) + texto libre

   d) Procedimientos realizados:
      - Checkboxes: Citología, Cultivo vaginal, Biopsia de cuello,
        Biopsia de vulva, Radiocirugía, Láser, HIFU, Exosoma,
        Colocación de hilos, Otro
      - Para cada procedimiento seleccionado: campo de notas + botón
        para adjuntar foto antes/después.

2. ALMACENAMIENTO:
   Todo esto va en clinical_notes.specialty_data JSONB bajo una key
   "gynecological_exam". El schema Zod debe validar cada campo.

3. FOTOS ANTES/DESPUÉS DE PROCEDIMIENTOS:
   - En la sección de procedimientos, botón "Agregar fotos" que permite
     subir 2 imágenes: antes y después.
   - Se guardan como attachments normales pero con category = 'procedure_photo'
     y un campo adicional en el JSONB: procedure_type y photo_type ('before'|'after').
   - En la vista de la nota, mostrar las fotos lado a lado.

4. VISTA DE LECTURA:
   Cuando la nota está firmada, mostrar el examen ginecológico en formato
   de lectura limpio con las secciones organizadas.

5. PERMISOS: Solo doctor puede llenar. Admin puede leer. Receptionist no ve.
```

---

## FASE 5 — Ecografía e informes de imagen
**Objetivo:** Que el doctor registre hallazgos ecográficos con medidas y pueda adjuntar imágenes/videos del ecógrafo.
**Modelo:** Opus 4.7 · Effort: high

```
Lee CLAUDE.md y el schema actual.

El ginecólogo hace ecografías en cada consulta. Necesita registrar los hallazgos
de forma estructurada y adjuntar imágenes.

1. SECCIÓN "ECOGRAFÍA" en la nota de evolución:
   Agregar como sección colapsable:

   a) Ecografía ginecológica:
      - Útero:
        - Posición: select (AVF, RVF, lateral, no visualizado)
        - Dimensiones: longitud (mm), anteroposterior (mm), transverso (mm)
        - Endometrio: grosor (mm), patrón (select: trilaminar, homogéneo, heterogéneo, no evaluable)
        - Hallazgos: textarea (miomas, pólipos, etc.)
      - Ovario derecho:
        - Dimensiones: longitud (mm) x ancho (mm)
        - Volumen (calculado automático: 0.523 × L × A × AP)
        - Folículos: número, tamaño del dominante (mm)
        - Hallazgos: textarea
      - Ovario izquierdo: (mismos campos)
      - Vejiga: select (normal, distendida, con contenido) + textarea
      - Líquido libre en Douglas: select (ausente, escaso, moderado, abundante)

   b) Ecografía obstétrica (se muestra si la paciente tiene embarazo activo):
      - Número de fetos: select (1, 2, 3+)
      - Presentación: select (cefálica, podálica, transversa, no aplica)
      - FCF (frecuencia cardíaca fetal): integer (lpm)
      - Biometría fetal:
        - DBP (diámetro biparietal, mm)
        - CC (circunferencia cefálica, mm)
        - CA (circunferencia abdominal, mm)
        - LF (longitud del fémur, mm)
        - Peso estimado (g) — calculado por fórmula de Hadlock
      - Líquido amniótico: ILA (cm) o bolsillo mayor (cm)
      - Placenta: localización (select: anterior, posterior, fúndica, previa),
        grado (select: 0, I, II, III)
      - Hallazgos adicionales: textarea

   c) Imágenes de ecografía:
      - Botón "Adjuntar imágenes del eco" que sube fotos/capturas del ecógrafo.
      - Acepta JPG, PNG y también MP4/MOV para videos cortos (máximo 50MB para video).
      - Se almacenan como attachments con category = 'ultrasound'.
      - Se muestran inline en la nota como galería.

2. ALMACENAMIENTO:
   Los hallazgos ecográficos van en clinical_notes.specialty_data JSONB
   bajo key "ultrasound".

3. CALCULADORAS AUTOMÁTICAS:
   - Volumen ovárico: 0.523 × L × A × AP (tres dimensiones)
   - Peso fetal estimado: fórmula de Hadlock usando DBP, CC, CA, LF
   - Edad gestacional por biometría: tabla estándar por DBP o LF

4. Si la migración de adjuntos necesita soportar video (MP4/MOV),
   actualizar la whitelist de MIME types en el upload handler.
   Agregar: video/mp4, video/quicktime. Magic bytes para MP4.

5. VISTA DE LECTURA: mostrar hallazgos ecográficos en formato legible
   con las imágenes adjuntas al final.
```

---

## FASE 6 — Calculadoras médicas y seguimiento obstétrico
**Objetivo:** Herramientas de cálculo integradas y seguimiento automático del embarazo.
**Modelo:** Sonnet 4.6 · Effort: high

```
Lee CLAUDE.md y el schema actual.

1. CALCULADORAS EN EL SIDEBAR O COMO HERRAMIENTA FLOTANTE:
   Crea un componente "Herramientas médicas" accesible desde un botón
   en el sidebar o como drawer lateral:

   a) Edad gestacional:
      - Input: FUM (fecha última menstruación)
      - Output: semanas + días, fecha probable de parto (FUM + 280 días)
      - Regla de Naegele: FUM - 3 meses + 7 días + 1 año
      - Trimestre actual

   b) Fecha probable de parto:
      - Input: FUM o edad gestacional actual
      - Output: fecha estimada

   c) IMC:
      - Input: peso (kg), talla (cm)
      - Output: IMC, clasificación (bajo peso, normal, sobrepeso, obesidad I/II/III)
      - Para embarazadas: ganancia de peso recomendada según IMC pregestacional

   d) Dosis por peso:
      - Input: peso del paciente, dosis en mg/kg
      - Output: dosis total

2. SEGUIMIENTO OBSTÉTRICO AUTOMÁTICO:
   - Si la paciente tiene en su medical_history.specialty_data una FUM activa
     y no se ha registrado "fin de embarazo", el sistema calcula automáticamente
     la edad gestacional actual y la muestra:
     - En la ficha del paciente: badge "🤰 32 semanas + 4 días"
     - En la nueva nota: pre-llena el campo de edad gestacional
     - En la lista de pacientes: indicador visual de embarazo activo
   - Cuando el doctor registra una nota con "parto" o "cesárea" o marca
     fin de embarazo, el badge desaparece.

3. CAMPO "ÚLTIMA VISITA" EN LA FICHA:
   - Mostrar "Última consulta: hace 15 días (22/04/2026)" calculado
     automáticamente desde la última nota de evolución.
   - Si tiene cita programada: "Próxima cita: en 5 días (13/05/2026)"

4. TIMELINE DE VISITAS:
   - En la ficha del paciente, sección que muestre una línea de tiempo
     visual de todas las consultas con:
     - Fecha
     - Tiempo transcurrido entre consultas
     - Diagnóstico principal
     - Si fue consulta de control, primera vez, urgencia, etc.
```

---

## FASE 7 — Órdenes médicas e interconsultas
**Objetivo:** Generar órdenes de laboratorio, de imágenes y referencias a especialistas de forma profesional.
**Modelo:** Sonnet 4.6 · Effort: high

```
Lee CLAUDE.md y el módulo de documentos clínicos existente (clinical_documents).

Extiende el módulo de documentos para incluir órdenes médicas e interconsultas
más estructuradas que las referencias simples que ya existen.

1. NUEVOS TIPOS DE DOCUMENTO (agregar al enum clinical_document_type):
   - 'lab_order' — Orden de laboratorio
   - 'imaging_order' — Orden de estudios de imagen
   - 'interconsultation' — Interconsulta formal

2. ORDEN DE LABORATORIO (lab_order):
   Content schema:
   {
     "studies": [
       { "name": "Hematología completa", "notes": "" },
       { "name": "Perfil hormonal (FSH, LH, Estradiol, Progesterona)", "notes": "Día 3 del ciclo" },
       { "name": "Espermograma", "notes": "Para la pareja" }
     ],
     "clinical_indication": "Estudio de fertilidad",
     "fasting_required": true,
     "urgency": "routine" | "urgent",
     "additional_instructions": ""
   }

   Formulario:
   - Lista de estudios frecuentes por categoría con checkboxes:
     * Hematología: Hematología completa, VSG, PCR
     * Química: Glicemia, Urea, Creatinina, Ácido úrico, Perfil lipídico, Perfil hepático
     * Hormonas: FSH, LH, Estradiol, Progesterona, Prolactina, TSH, T4L, Testosterona, DHEA-S, AMH
     * Serología: HIV, VDRL, Hepatitis B y C, Toxoplasma, Rubéola, CMV
     * Orina: Uroanálisis, Urocultivo
     * Otros: Cultivo vaginal, Citología, Tipaje sanguíneo
     * Pareja: Espermograma, Tipaje sanguíneo
   - El médico marca los que necesita + agrega otros libremente.
   - Campo de indicación clínica (texto).
   - Toggle de ayuno.

3. ORDEN DE IMAGEN (imaging_order):
   Content schema:
   {
     "studies": [
       { "name": "Eco transvaginal", "notes": "" },
       { "name": "Mamografía bilateral", "notes": "Control anual" }
     ],
     "clinical_indication": "Control ginecológico anual",
     "urgency": "routine" | "urgent"
   }

   Formulario:
   - Lista frecuente: Eco transvaginal, Eco obstétrico, Eco mamario,
     Mamografía, Histerosalpingografía, Resonancia pélvica, TAC
   - Checkboxes + campo libre.

4. INTERCONSULTA MEJORADA (interconsultation):
   Mejorar el tipo 'referral' existente o crear uno nuevo más formal:
   {
     "specialty": "Cardiología",
     "doctor_name": "Dr. Pérez" (opcional),
     "reason": "HTA diagnosticada durante control prenatal",
     "clinical_summary": "Paciente de 28 semanas con TA 150/95...",
     "current_medications": "Metformina 850mg c/12h...",
     "urgency": "routine" | "priority" | "urgent",
     "questions_for_specialist": "¿Manejo antihipertensivo compatible con embarazo?"
   }

   Formulario:
   - Select de especialidades frecuentes: Cardiología, Nutrición,
     Perinatología, Hematología, Endocrinología, Urología, Genética,
     Psicología, Anestesiología
   - Pre-llenado automático de resumen clínico y medicación actual
     desde la última nota y medical_history.

5. VISTA DE IMPRESIÓN para cada tipo: profesional, con header de clínica,
   datos del paciente, cuerpo del documento, firma del médico.

6. Migración del enum + nuevos schemas Zod + actualizar formulario dinámico.
```

---

## FASE 8 — Exportar historial completo a PDF
**Objetivo:** El paciente se va del país o cambia de médico y necesita toda su historia.
**Modelo:** Sonnet 4.6 · Effort: high

```
Lee CLAUDE.md y las queries existentes.

Crea un generador de PDF completo del historial del paciente.

1. BOTÓN "Exportar historial" en la ficha del paciente.
   Solo visible para admin y doctor.

2. El PDF debe incluir (en este orden):
   a) Portada:
      - Logo y nombre de la clínica
      - "HISTORIA CLÍNICA — [Nombre del paciente]"
      - Fecha de generación
      - "Documento generado por Hisamed — hisamed.com"

   b) Datos del paciente:
      - Nombre, cédula, fecha de nacimiento, edad, sexo
      - Teléfono, email, dirección
      - Grupo sanguíneo, alergias destacadas
      - Datos de la pareja (si existen)

   c) Antecedentes:
      - Personales, familiares, quirúrgicos, alergias, medicación actual
      - Antecedentes ginecológicos/obstétricos
      - Fórmula obstétrica

   d) Consultas (cronológico, más reciente primero):
      - Fecha y nombre del médico
      - Signos vitales
      - Motivo de consulta
      - Nota SOAP completa
      - Diagnósticos (con código CIE-10)
      - Hallazgos ecográficos si los hay
      - Indicaciones/plan

   e) Documentos generados:
      - Lista de reposos, récipes, referencias emitidas (solo metadatos,
        no el contenido completo)

   f) Adjuntos:
      - Lista de adjuntos (nombre, fecha, categoría)
      - Las imágenes se pueden incluir inline si el PDF no queda >20MB

3. GENERACIÓN:
   - Usa una librería server-side para generar el PDF.
   - Opciones: puppeteer (headless Chrome), o @react-pdf/renderer,
     o jsPDF. Recomiendo crear un HTML con CSS y convertirlo a PDF
     con puppeteer ya que el diseño es complejo.
   - El PDF se genera on-demand (no se almacena).
   - Route Handler GET /api/patients/[id]/export-history que:
     - Verifica auth + rol (admin/doctor) + clinic_id
     - Recopila todos los datos del paciente
     - Genera el PDF
     - Lo retorna como response con Content-Type: application/pdf
     - Audit log EXPORT

4. OPCIÓN DE ENVIAR POR EMAIL:
   - Después de generar, ofrecer botón "Enviar por correo".
   - Input del email del destinatario (pre-llenado con el del paciente).
   - Usa Resend o similar para enviar el PDF como adjunto.
   - Esto es post-MVP — por ahora solo descarga directa.
```

---

## FASE 9 — Reportes y estadísticas del consultorio
**Objetivo:** Que el administrador/doctor vea métricas de su práctica.
**Modelo:** Sonnet 4.6 · Effort: medium

```
Lee CLAUDE.md.

Crea una página /reportes accesible para admin y doctor.

1. DASHBOARD DE REPORTES con cards y gráficos:

   a) Consultas:
      - Total de consultas por mes (gráfico de barras, últimos 12 meses)
      - Consultas por día de la semana (para optimizar agenda)
      - Promedio de consultas por día

   b) Pacientes:
      - Nuevos pacientes por mes
      - Total de pacientes activos
      - Distribución por edad (histograma)
      - Distribución por motivo de consulta

   c) Diagnósticos:
      - Top 10 diagnósticos más frecuentes (si hay CIE-10)
      - Gráfico de torta/donut

   d) Productividad:
      - Consultas por médico (si hay más de uno)
      - Tasa de no-show (citas marcadas como no_show / total)
      - Tiempo promedio entre citas del mismo paciente

2. FILTROS:
   - Rango de fechas
   - Médico (si hay más de uno)

3. EXPORTAR:
   - Botón "Exportar a CSV" para cada tabla de datos.

4. Usar recharts para los gráficos.
   Las queries deben ser eficientes (GROUP BY, COUNT, no cargar
   todos los registros al cliente).

5. Agregar "Reportes" al sidebar de navegación (solo admin/doctor).
```

---

## FASE 10 — Pulido funcional y detalles de UX
**Objetivo:** Arreglar los detalles que faltan para que el producto se sienta completo.
**Modelo:** Sonnet 4.6 · Effort: medium

```
Lee CLAUDE.md y revisa el estado actual de la aplicación.

Implementa estos detalles de UX que faltan:

1. BÚSQUEDA GLOBAL:
   - En el header, agregar un input de búsqueda global (Ctrl+K para abrir).
   - Busca pacientes por nombre, cédula o teléfono.
   - Busca notas clínicas por diagnóstico.
   - Muestra resultados agrupados: "Pacientes (3)", "Notas (2)".
   - Al seleccionar, navega a la ficha/nota.

2. ATAJOS DE TECLADO:
   - Ctrl+K: Búsqueda global
   - Ctrl+N: Nuevo paciente (desde cualquier página)
   - Ctrl+Shift+N: Nueva cita (desde cualquier página)

3. BREADCRUMBS:
   - En todas las páginas interiores, mostrar la ruta:
     Pacientes > Ana María González > Notas > Nueva nota
   - Cada segmento es clickeable.

4. EMPTY STATES MEJORADOS:
   - Cuando no hay pacientes: ilustración + "Registra tu primer paciente"
   - Cuando no hay citas hoy: "No tienes citas programadas para hoy"
   - Cuando no hay notas: "Aún no hay consultas registradas"

5. LOADING STATES:
   - Skeleton loaders en la lista de pacientes, agenda y notas
     mientras cargan los datos.

6. NOTIFICACIONES TOAST:
   - Reemplazar los banners de éxito/error por toasts (shadcn Sonner).
   - "Paciente registrado exitosamente" → toast verde 3 segundos.
   - "Error al guardar" → toast rojo persistente.

7. RESPONSIVE FINAL:
   - Verificar que todas las pantallas funcionen en tablet (768px).
   - Las tablas se convierten en cards en móvil.
   - Los formularios stack verticalmente.

8. DARK MODE (opcional pero diferenciador):
   - Toggle en el header usuario.
   - Usar las variables CSS de Tailwind dark:.
   - Guardar preferencia en localStorage.
```

---

## FASE 11 — Redesign completo de UI
**Objetivo:** Que Hisamed se vea como un producto premium de clase mundial.
**Modelo:** Sonnet 4.6 · Effort: high

```
Lee CLAUDE.md y revisa toda la UI actual.

Redesign completo de la interfaz. NO cambies lógica, server actions, queries
ni permisos. Solo modifica componentes, estilos y estructura HTML.

## Principios de diseño

1. Paleta médica profesional: fondo claro (#FAFAFA), sidebar oscuro (#1E293B),
   accent teal médico (#0D9488) para acciones principales,
   azul para información (#3B82F6), rojo para alertas (#EF4444).
2. Tipografía: Inter. Tamaños jerárquicos claros.
3. Espaciado generoso. Cards con bordes sutiles (border-zinc-200), sombras suaves.
4. Feedback visual: hover states, transiciones 150ms, loading states.
5. Modo claro por defecto.

## Pantallas (en orden de prioridad)

### 1. Login (/login)
- Split layout: formulario a la izquierda, branding/gradiente a la derecha.
- Logo de Hisamed centrado sobre el formulario.
- "Historia clínica electrónica" como subtítulo.
- Campos con labels flotantes, bordes redondeados.
- Botón teal prominente con loading state.
- Footer: "© 2026 Hisamed · Powered by Atriqon"

### 2. Sidebar
- Fondo oscuro (#1E293B), texto blanco/gris.
- Logo Hisamed arriba (blanco sobre oscuro).
- Items con iconos + texto, activo con barra lateral teal + fondo sutil.
- Separador entre navegación principal y configuración.
- Usuario abajo: avatar + nombre + rol en texto pequeño.
- Colapsable: en modo colapsado solo iconos, tooltip con nombre.

### 3. Dashboard (/)
- Saludo: "Buenos días, Dr. [Nombre]" con la fecha actual.
- 4 stat cards en fila: Pacientes activos, Citas hoy, En espera, Consultas del mes.
  Cada card con icono coloreado, número grande, label debajo.
- Sección "Pacientes del día" como tabla/lista limpia.
- Para doctor: "Próximo paciente" como card destacada con botón verde "Atender".

### 4. Lista de pacientes (/pacientes)
- Search bar grande arriba con placeholder animado.
- Tabla con avatares (foto o iniciales), nombre, edad, cédula, teléfono,
  última consulta, badge de embarazo si aplica.
- Hover con fondo sutil. Click toda la fila.
- Botón "Nuevo paciente" arriba a la derecha, teal.
- Paginación limpia abajo.

### 5. Ficha del paciente (/pacientes/[id])
- Header tipo perfil: avatar grande, nombre en título, edad · cédula · teléfono
  en subtítulo. Badges: grupo sanguíneo, embarazo activo.
- Banner de alergias rojo si aplica.
- Tabs con iconos: Datos, Pareja, Citas, Historia, Notas, Documentos,
  Adjuntos, Evolución.

### 6. Agenda (/agenda)
- Vista diaria: timeline vertical con cards por cita.
- Colores por estado más suaves (pasteles, no saturados).
- "Nueva cita" como botón flotante (FAB) en mobile.

### 7. Notas de evolución
- Formulario SOAP con textareas grandes y bordes claros.
- Sección de signos vitales como grid compacto arriba.
- Sección de ecografía colapsable con campos organizados.
- Badges "Borrador" (amarillo) y "Firmada" (verde) más visibles.

### 8. Vista de impresión de documentos
- Limpia, profesional, sin elementos de UI.
- Logo de la clínica centrado arriba.
- Tipografía serif para el cuerpo del documento.
- Línea de firma con nombre del médico y cargo.

Usa solo TailwindCSS v4 + shadcn/ui. No instales librerías externas de UI.
Las transiciones con CSS transitions de Tailwind.
Verifica que pnpm dev compile después de cada pantalla.
```

---

## Orden de ejecución y modelo recomendado

| Fase | Feature | Modelo | Effort | Estimado |
|------|---------|--------|--------|----------|
| 1 | Datos ampliados + pareja + alertas | Sonnet 4.6 | high | 1 día |
| 2 | Signos vitales + gráficos | Sonnet 4.6 | high | 1-2 días |
| 3 | CIE-10 buscable | Sonnet 4.6 | high | 1 día |
| 4 | Examen ginecológico estructurado | Opus 4.7 | high | 1-2 días |
| 5 | Ecografía + imágenes | Opus 4.7 | high | 1-2 días |
| 6 | Calculadoras + seguimiento obstétrico | Sonnet 4.6 | high | 1 día |
| 7 | Órdenes médicas e interconsultas | Sonnet 4.6 | high | 1-2 días |
| 8 | Exportar historial a PDF | Sonnet 4.6 | high | 1-2 días |
| 9 | Reportes y estadísticas | Sonnet 4.6 | medium | 1 día |
| 10 | Pulido UX | Sonnet 4.6 | medium | 1-2 días |
| 11 | Redesign UI | Sonnet 4.6 | high | 2-3 días |

**Total estimado: 12-18 días de trabajo**

## Después de cada fase:
1. Probar en local (pnpm dev)
2. Commitear con mensaje descriptivo
3. Redeploy a producción (ssh + git pull + docker compose up --build)
4. Hacer que tu papá pruebe si es relevante

## Revisiones de seguridad con Opus:
- Después de Fase 1 (nuevas tablas + permisos)
- Después de Fase 4 (datos clínicos sensibles)
- Después de Fase 8 (exportación de datos)
