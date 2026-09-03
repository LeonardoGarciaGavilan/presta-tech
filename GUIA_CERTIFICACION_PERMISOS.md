# Guía de Certificación — Módulo de Permisos (App Móvil)

Certificación manual en **producción** (Railway) del sistema de permisos: login por rol, navegación a la matriz, guardado tri-estado, propagación `authVersion`, deshabilitado de módulos por Super Admin, deep links, sync offline y push notifications.

> Estado previo ya certificado (automático): backend jest 58/58 + E2E 58/58 (incl. `permisos.e2e-spec.ts`), móvil jest 184/184, `expo lint` 0 errores, `tsc --noEmit` sin errores nuevos. **Esta guía certifica el runtime en dispositivo**, que tsc/lint/jest no cubren.

- API base: `https://presta-tech-production.up.railway.app/api/v1`
- Web / Super Admin: `https://presta-tech.vercel.app`
- Scheme de deep links: `sas-prestamos://`

## 1. Pre-requisitos
- [ ] Dispositivo físico (iOS/Android) con la app apuntando a producción (dev build o Expo Go con la URL de producción).
- [ ] Acceso web al panel Super Admin (`https://presta-tech.vercel.app`).
- [ ] Acceso al repo para ejecutar los scripts de usuarios de prueba contra la DB de producción.
- [ ] Notificaciones push habilitadas en el dispositivo (ajustes del sistema).

## 2. Preparación — usuarios de prueba
> Si ya existen, marca y omite. **Advertencia:** estos scripts usan la `DATABASE_URL` del `.env` del backend → asegúrate de que apunte a la DB de producción.
- [ ] **SUPERADMIN**: completar `EMAIL`/`PASSWORD`/`NOMBRE` en `backend/src/scripts/create-superadmin.ts` y ejecutar `npx ts-node scripts/create-superadmin.ts`. Entrar desde la **web** (el móvil rechaza Super Admin).
- [ ] **ADMIN**: `npx ts-node scripts/create-admin.ts` → crea empresa "Gavilan Prestamos" + `gavilan@gmail.com` / `Admin123*`.
  - [ ] Nota: este script no setea `debeCambiarPassword` → al primer login la app pedirá cambiar la clave (flujo `/cambiar-password`). Completa el cambio para continuar.
- [ ] **EMPLEADO**: `npx ts-node scripts/create-employee.ts` → `empleado@sasprestamos.com` / `Empleado123*` (asignado a la primera empresa existente).
- [ ] Verificar conectividad: login correcto con cada usuario desde la app.

## 3. Caso A — Login por rol
- [ ] **ADMIN** desde móvil: entra a Dashboard + tabs (Caja, Préstamos, Rutas, Clientes) + drawer "Administración" completo.
- [ ] **EMPLEADO** desde móvil: entra a sus módulos base (clientes ver/crear/editar, préstamos, caja, rutas, configuraciones: ver, alertas) y **NO** ve las pantallas admin/* (Usuarios, Reportes, Gastos, etc.).
- [ ] **SUPERADMIN** intentando login desde móvil → debe fallar con "El Super Admin solo inicia sesión desde la web". Desde la web entra sin problema.
- [ ] No repetir logins fallidos seguidos: al 5º fallo el email queda bloqueado 10 min (y login es 10 intentos/5 min).

## 4. Caso B — Navegación y matriz de permisos (Fase 7)
- [ ] Como ADMIN: drawer → **Usuarios** → tap en un usuario → pantalla **Permisos**.
- [ ] El título y el botón **volver** se ven **debajo del reloj/notch** (zona segura), no pegados arriba.
- [ ] Hay **un solo** header "Permisos" (no dos apilados).
- [ ] Botón **volver (←)**: regresa a la **lista de Usuarios** (NUNCA al Dashboard).
- [ ] **Cabeceras por módulo**: cada grupo muestra icono + nombre legible ("Préstamos", sin el código duplicado), pill "x de y" coloreada según avance (verde=todo, ámbar=parcial, neutro=ninguno) y barra de progreso fina.
- [ ] **Guardar**: cambiar estados (Por defecto/Permitir/Denegar) → "Guardar permisos" → toast de éxito → aterriza en **Usuarios** (no en Dashboard).

## 5. Caso C — Tri-estado y permisos efectivos
- [ ] En la matriz de un EMPLEADO, marcar un permiso como **Denegar** (ej. `clientes:editar`) → Guardar → el badge del permiso muestra "Denegado" y en la app del empleado desaparece/queda bloqueada la acción.
- [ ] **Por defecto** = permisos del rol: verificar en el badge "Por defecto · sí/no".
- [ ] **ADMIN no puede editar sus propios permisos** ni los de un SUPERADMIN (la pantalla no debe permitirlo).
- [ ] Con un EMPLEADO logueado: crear un **segundo** EMPLEADO restringido (solo `clientes:ver`, todo lo demás Denegar) → ese usuario debe ver únicamente Clientes y Dashboard.

## 6. Caso D — authVersion / propagación en caliente
- [ ] Con la app abierta del EMPLEADO (en segundo plano), desde la web/otro ADMIN cambiarle un permiso (p. ej. otorgar `pagos:ver`).
- [ ] Volver a primer plano la app del EMPLEADO → aparece toast **"Tus permisos fueron actualizados"** y el permiso se aplica **sin re-login**.
- [ ] Cambiar el **rol** o `activo` de un usuario → misma propagación al volver al primer plano.

## 7. Caso E — Módulos por Super Admin (producción)
> ⚠️ **Advertencia:** deshabilitar un módulo afecta a TODOS los usuarios de la empresa en producción. Deshabilítalo solo unos segundos y vuelve a habilitarlo. Verifica el impacto real en cada paso.
- [ ] Web → Super Admin → empresa → límites → **deshabilitar `CLIENTES`** (`PUT /superadmin/empresas/:id/limites` con `modulosDeshabilitados`).
- [ ] En la app (ADMIN y EMPLEADO): la tab **Clientes desaparece** del bottom bar.
- [ ] Acceder a `/clientes` por deep link → bloqueado (pantalla Sin Acceso / `MODULO_DESACTIVADO`).
- [ ] Al volver a primer plano → toast de permisos actualizados (authVersion bump).
- [ ] **Re-habilitar `CLIENTES`** → la tab vuelve a aparecer y el acceso se restaura.
- [ ] Deshabilitar **`SYNC`** → la pantalla Sincronización queda bloqueada.

## 8. Caso F — Deep links
- [ ] `sas-prestamos://admin/usuarios` → abre Usuarios.
- [ ] `sas-prestamos://admin/permisos/<id>` → abre la matriz de ese usuario (usa un `id` real). Al pulsar **volver** → Usuarios.
- [ ] `sas-prestamos://clientes` → abre el tab Clientes.
- [ ] Deep link a una pantalla **sin permiso** → Sin Acceso.
- [ ] En Expo Go el formato es `exp://<host>/--/<ruta>`; en dev build/EAS se usa el scheme `sas-prestamos://`.

## 9. Caso G — Sync offline
- [ ] Icono `sync` (CompanyHeader, con badge de pendientes) abre **Sincronización**.
- [ ] "Sincronizar ahora" y "Forzar recarga de datos" completan sin errores.
- [ ] **Modo avión**: crear un cliente/préstamo → queda en cola (badge rojo de pendientes).
- [ ] **Reconectar** → la app dispara sync automático → la operación se sube y el badge se limpia.
- [ ] En un EMPLEADO restringido: el sync solo baja lo que puede ver (sin `pagos:ver` no baja pagos).

## 10. Caso H — Push notifications
- [ ] ADMIN con `alertas:ver` en **dispositivo físico** (token registrado automáticamente al loguearse).
- [ ] Crear un préstamo o cambiar su estado (desde la app o la web) → en segundos llega **notificación push** "Alerta — …".
- [ ] Al tocar la notificación → navega a **admin/alertas**.
- [ ] La alerta aparece en la pantalla Alertas.
- [ ] EMPLEADO **sin** `alertas:ver` → **no** registra token y **no** recibe push.

## 11. Caso I — Seguridad y límites
- [ ] `X-App: mobile` rechaza SUPERADMIN también en refresh de token.
- [ ] Endpoints de negocio con SUPERADMIN → 403 (solo usa el panel web).
- [ ] Throttler: repetir logins fallidos dispara bloqueo con mensaje de minutos restantes.

## 12. Lista de verificación final
- [ ] Login ADMIN / EMPLEADO / SUPERADMIN correctos (web vs móvil).
- [ ] Matriz: navegación volver→Usuarios, header con zona segura, sin doble header.
- [ ] Cabeceras por módulo con icono, pill y barra de progreso.
- [ ] Guardado tri-estado + bloqueo de pantalla del empleado restringido.
- [ ] Propagación authVersion sin re-login.
- [ ] Deshabilitado/rehabilitado de módulo por Super Admin.
- [ ] Deep links (incluido volver→Usuarios desde permisos).
- [ ] Sync offline (cola, reconexión, limpieza).
- [ ] Push notifications (ADMIN recibe, EMPLEADO sin permiso no).

## 13. Evidencias
- [ ] Capturas: matriz con cabeceras, header con zona segura, back→Usuarios, Sin Acceso en pantalla bloqueada, tab Clientes oculta con módulo deshabilitado, notificación recibida, toast "Tus permisos fueron actualizados".
- [ ] Pegar el resultado en `PLAN_PERMISOS.md` como "Certificación manual completada".

## 14. Limpieza
- [ ] Dejar **todos los módulos habilitados** (no dejar producción alterada).
- [ ] Si se crearon usuarios de prueba solo para esto, **desactivarlos** (`activo: false`) o eliminarlos vía web.
- [ ] Documentar incidencias encontradas con pasos para reproducir.
