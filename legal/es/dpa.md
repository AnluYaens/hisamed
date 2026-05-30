<!--
BORRADOR — NO ES ASESORÍA LEGAL. Borrador de trabajo para revisión y adaptación
por un abogado calificado antes de su publicación.

SECCIONES QUE MÁS NECESITAN REVISIÓN LEGAL:
  - Sección 1 (asignación responsable / encargado) — marco legal central; debe
    validarse frente a la ley aplicable de datos médicos y de protección de
    datos.
  - Sección 5 (subencargados) — mantener la lista exacta; revisar la base legal
    de subencargados en EE. UU. que sirven a responsables en América Latina.
  - Sección 6 (plazos de notificación de brechas) y Sección 7
    (devolución/eliminación) — las obligaciones y plazos requieren visto bueno
    legal.
-->

# Acuerdo de Tratamiento de Datos (AT / DPA)

> **Borrador — pendiente de revisión legal.** Este documento es un borrador
> inicial provisto para revisión y adaptación. No es un acuerdo legal final ni
> vinculante y no constituye asesoría legal.

**Última actualización:** 30 de mayo de 2026

Este Acuerdo de Tratamiento de Datos ("AT" o "DPA") forma parte de los Términos
del Servicio entre usted ("el Médico") y Hisamed, y rige el tratamiento de los
datos personales de pacientes dentro del Servicio.

## 1. Roles de las partes

- **Usted (el Médico) es el responsable del tratamiento.** Usted determina qué
  datos de pacientes se recopilan y por qué, y es responsable de contar con la
  base legal y cualquier consentimiento del paciente requerido para procesarlos.
- **Hisamed es el encargado del tratamiento.** Hisamed es operado actualmente
  por **Angel Jaen como persona natural (comerciante individual)** (no una
  empresa), y procesa los datos de pacientes únicamente según sus instrucciones
  documentadas para prestar el Servicio.

## 2. Naturaleza y finalidad del tratamiento

Hisamed procesa los datos de pacientes únicamente para proporcionar
**funcionalidad de historia clínica electrónica (HCE)** — almacenar, mostrar,
organizar y recuperar las historias clínicas que usted crea o sube, incluyendo
la generación de documentos y la gestión de adjuntos.

## 3. Categorías de titulares y de datos

- **Titulares de los datos:** los pacientes del Médico (e, incidentalmente, los
  usuarios de la propia cuenta del Médico).
- **Categorías de datos:** historias y registros clínicos; identificadores
  personales; información demográfica y de contacto; e imágenes o archivos
  adjuntos a las historias de pacientes.

Esto incluye datos sensibles de salud; ambas partes reconocen que deben
manejarse con el cuidado apropiado.

## 4. Obligaciones del encargado

Hisamed se compromete a:

- procesar los datos de pacientes **solo según sus instrucciones** y únicamente
  para prestar el Servicio — nunca para fines propios, publicidad ni
  entrenamiento de modelos de IA;
- aplicar **medidas de seguridad técnicas y organizativas razonables** (TLS en
  tránsito, hash de contraseñas argon2id, aislamiento multiinquilino probado por
  un conjunto automatizado), con el mejor esfuerzo apropiado para un piloto de
  acceso anticipado;
- asegurar que las personas autorizadas a procesar los datos estén obligadas a
  la confidencialidad;
- restringir el acceso a los datos a lo estrictamente necesario para operar,
  proteger, dar soporte y depurar el Servicio; y
- asistirle, en la medida razonablemente posible, en responder a las solicitudes
  de los pacientes para ejercer sus derechos.

Hisamed no ofrece certificación HIPAA ni un SLA formal durante el piloto.

## 5. Subencargados

Usted autoriza a Hisamed a emplear los siguientes subencargados. Todos almacenan
o procesan datos en infraestructura ubicada en los **Estados Unidos**:

| Subencargado   | Rol / datos que maneja                                       | Ubicación |
|----------------|--------------------------------------------------------------|-----------|
| **Supabase**   | Base de datos principal — historias de pacientes y datos de cuenta | US East   |
| **Cloudflare** | Almacenamiento de objetos R2 — archivos e imágenes subidos    | EE. UU.   |
| **Resend**     | Correo transaccional — p. ej., correos de cuenta/contraseña (sin contenido clínico) | EE. UU. |

El alojamiento de la aplicación se realiza en **DigitalOcean (EE. UU.)**. Le
notificaremos sobre cualquier subencargado nuevo o de reemplazo e impondremos a
cada subencargado obligaciones de protección de datos coherentes con este AT.

## 6. Brecha de datos personales

Si Hisamed tiene conocimiento de una brecha de datos personales que afecte los
datos de sus pacientes, Hisamed le **notificará a usted (el Médico) sin demora
indebida** tras tener conocimiento, con la información razonablemente disponible,
para que pueda cumplir cualquier obligación de notificación que tenga como
responsable. *(Plazo específico por confirmar en la revisión legal.)*

## 7. Devolución y eliminación de datos

Al terminar el Servicio o su cuenta, o a su solicitud, Hisamed, a su elección,
pondrá a disposición sus datos de pacientes para **exportación** y/o los
**eliminará** de los sistemas activos dentro de un plazo razonable, salvo cuando
la ley requiera su conservación. Las copias residuales en respaldos se purgan en
el ciclo normal de rotación de respaldos.

## 8. Transferencias internacionales

Dado que toda la infraestructura está en EE. UU. (Sección 5), los datos de
pacientes de titulares ubicados en América Latina se transfieren y almacenan en
los Estados Unidos. El Médico reconoce esto y es responsable de cualquier
divulgación o consentimiento que ello requiera bajo la ley local.

## 9. Responsabilidad y cambios

Las disposiciones de responsabilidad y el proceso de cambios de los Términos del
Servicio aplican a este AT. En caso de conflicto entre este AT y los Términos
respecto al tratamiento de datos de pacientes, prevalece este AT.

## 10. Contacto

Preguntas sobre el tratamiento de datos: **Angel Jaen — legal@hisamed.com**.
