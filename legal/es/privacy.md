<!--
BORRADOR — NO ES ASESORÍA LEGAL. Borrador de trabajo para revisión y adaptación
por un abogado calificado antes de su publicación.

SECCIONES QUE MÁS NECESITAN REVISIÓN LEGAL:
  - Secciones 2 y 9 (derechos del titular / paciente) — cómo fluyen los derechos
    de acceso, rectificación y eliminación a través del médico (responsable) vs.
    Hisamed (encargado) bajo la ley de datos médicos aplicable.
  - Sección 4 (almacenamiento transfronterizo en EE. UU.) — suficiencia de la
    divulgación frente a las normas de protección de datos de América
    Latina / Venezuela.
  - Sección 7 (plazos de conservación) — deben alinearse con las obligaciones de
    conservación de historias clínicas en la jurisdicción de cada médico.
-->

# Política de Privacidad

> **Borrador — pendiente de revisión legal.** Este documento es un borrador
> inicial provisto para revisión y adaptación. No es un documento legal final ni
> vinculante y no constituye asesoría legal.

**Última actualización:** 30 de mayo de 2026

Esta Política de Privacidad explica cómo Hisamed maneja los datos personales.
Está dirigida a los **médicos** que usan Hisamed e, indirectamente, a **sus
pacientes**.

Dado que Hisamed es una herramienta de HCE, la mayoría de los datos del sistema
son datos de pacientes que el médico sube. Para esos datos, el **médico es el
responsable** y **Hisamed es el encargado** — ver el Acuerdo de Tratamiento de
Datos. Esta Política describe cómo nosotros, como operador de la plataforma,
protegemos todos los datos del sistema.

## 1. Quiénes somos

Hisamed es operado por **Angel Jaen como persona natural (comerciante
individual)**, no como una empresa. Contacto de privacidad:
**legal@hisamed.com**.

## 2. Qué datos recopilamos

**Datos de la cuenta del médico:** nombre, correo electrónico, contraseña
(almacenada solo como hash argon2id), nombre y configuración de la clínica, y
registros técnicos/de uso básicos necesarios para operar y proteger el Servicio.

**Datos de pacientes, subidos por el médico:** historias clínicas, notas
clínicas, identificadores, datos demográficos y de contacto, e imágenes o
archivos adjuntos a una historia. Nosotros no decidimos qué datos de paciente se
recopilan — lo hace el médico, en su rol de responsable.

No vendemos datos personales y no usamos datos de pacientes para publicidad ni
para entrenar modelos de IA.

## 3. Cómo usamos los datos

- para proporcionar y operar la funcionalidad de HCE que usted solicita;
- para autenticar usuarios y proteger las cuentas;
- para mantener, depurar y mejorar el Servicio; y
- para comunicarnos con usted sobre el Servicio.

Procesamos los datos de pacientes únicamente para prestar el Servicio según las
instrucciones del médico.

## 4. Dónde se almacenan los datos

**Todos los datos se almacenan en infraestructura ubicada en los Estados
Unidos.** Los médicos y pacientes en América Latina deben saber que sus datos
salen de su país. En concreto:

- **Alojamiento de la aplicación:** DigitalOcean (EE. UU.).
- **Base de datos:** Supabase, región US East.
- **Almacenamiento de archivos / imágenes:** Cloudflare R2.
- **Correo transaccional:** Resend (p. ej., restablecimiento de contraseña).

## 5. Cómo se protegen los datos

- **Cifrado en tránsito** mediante TLS en todas las conexiones.
- **Contraseñas con hash** argon2id; nunca almacenamos contraseñas en texto
  plano.
- **Aislamiento multiinquilino:** los datos de cada clínica están separados
  lógicamente de modo que una clínica no pueda acceder a los de otra. Este
  aislamiento está cubierto por un conjunto de pruebas automatizadas.

Somos honestos sobre nuestra etapa: la seguridad es **de mejor esfuerzo** y el
Servicio **no está certificado bajo HIPAA**. Aplicamos salvaguardas razonables
apropiadas para un piloto de acceso anticipado.

## 6. Quién tiene acceso

- **Solo los usuarios autorizados de la propia clínica** pueden acceder a los
  datos de pacientes de esa clínica a través de la aplicación.
- El operador (Angel Jaen) puede acceder a los datos solo en la medida
  estrictamente necesaria para operar, dar soporte, proteger o depurar el
  Servicio, y nunca para fines ajenos.
- Los subencargados (Sección 4) acceden a los datos solo para cumplir su rol de
  infraestructura. Ver el AT (DPA) para más detalles.

## 7. Conservación de datos

Conservamos los datos de la cuenta del médico y las historias de pacientes
mientras la cuenta esté activa. Al cerrar la cuenta o terminar el piloto, los
datos se devuelven y/o eliminan según se describe en el AT (DPA). Los médicos
son responsables de cualquier obligación de conservación de historias clínicas
impuesta por su propia jurisdicción. *(Plazos de conservación específicos por
confirmar en la revisión legal.)*

## 8. Cookies y sesiones

Usamos un número reducido de cookies estrictamente necesarias para mantener su
sesión iniciada y protegerla. No usamos cookies de publicidad ni de rastreo de
terceros.

## 9. Sus derechos

Los pacientes generalmente ejercen sus derechos (acceso, rectificación,
eliminación) a través de su médico, quien es el responsable de sus datos. Los
médicos pueden acceder, corregir o eliminar los datos de su cuenta en cualquier
momento, y pueden solicitar la exportación o eliminación total contactándonos.

Si usted es paciente y no sabe quién tiene sus registros, contacte primero a su
médico; también puede escribirnos a legal@hisamed.com.

## 10. Cambios a esta Política

Podemos actualizar esta Política. Los cambios materiales se notificarán por
correo electrónico o dentro de la aplicación.

## 11. Contacto

Preguntas de privacidad: **Angel Jaen — legal@hisamed.com**.
