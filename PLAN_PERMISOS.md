# Plan de implementación — Sistema de permisos (5 fases)

Estado: leyenda `[ ]` pendiente · `[x]` hecho · `[~]` en progreso
Última actualización: 12/08/2026 — Fases 1-5 completas. Pendiente verificación manual post-deploy.

---

## Fase 1 — Backend: seguridad (autoridad real) ✅ VERIFICADA

- [x] **1.1 `clientes.controller.ts`** — `@RequierePermiso`: `clientes:ver` (GET /, /inactivos, /:id, signed-url), `clientes:crear` (POST /), `clientes:editar` (PATCH /:id, POST /:id/cedula), `clientes:desactivar` (DELETE /, PATCH reactivar, relajar `@Roles('ADMIN')`→`('ADMIN','EMPLEADO')`). Eliminado `POST /test-upload`.
- [x] **1.2 `rutas.controller.ts` + `rutas.service.ts`** — `@Roles('ADMIN','EMPLEADO')` en todos los handlers (+ RolesGuard). `@RequierePermiso` por endpoint. Ownership en `marcarVisitado` (service:334): `rc.ruta.usuarioId === usuarioId` o `rutas:asignar`. `PermisosService` inyectado.
- [x] **1.3 `caja.controller.ts`** — `caja:ver` (GETs), `caja:abrir` (POST abrir), `caja:cerrar` (POST cerrar), `caja:ajuste` (PATCH /:id/cerrar).
- [x] **1.4 Alertas / Notificaciones** — `alertas:ver` en prestamos/alertas* y notificaciones/alertas. `POST moras/actualizar` → `@Roles('ADMIN')`.
- [x] **1.5 Dashboard** — `dashboard:ver` en GET / y /mobile + fix `user.id`→`user.userId`.
- [x] **1.6 Pagos + reportes** — `pagos:ver` en los 4 GETs de pagos y en `GET /reportes/cliente/:id`.
- [x] **1.7 `GET /sync/cambios`** — `@Roles('ADMIN','EMPLEADO')`; payload filtrado por permisos (clientes/prestamos/pagos/rutas/configuracion); `pagos` embebidos en préstamos condicionales; spec actualizado. Quitado `SUPERADMIN` de `GET /prestamos/calcular`.
- [x] **1.8 Idempotencia** — `@Idempotent()` + `@Throttle` en finanzas capital/inyeccion/retiro/retiro-capital; `@Idempotent()` en POST /empleados/pagos y PATCH /prestamos/:id/refinanciar.
- [x] **1.9 Limpieza** — eliminado `GET /auth/admin-only`.
- [x] **1.10 Catálogo** — retirados `pagos:revertir`, `reportes:ver`, `alertas:gestionar` (catálogo + base EMPLEADO); activado `configuracion:ver` (GET /configuracion).
- [x] **Verificación Fase 1** — `tsc --noEmit` OK · `nest build` OK · jest **55/55**.

## Fase 2 — Web: UX y coherencia (`frontend/`) ✅ COMPLETA

- [x] **2.1 Protección de rutas por permiso** — componente `AccesoDenegado`; wrapper `PermisoRoute`; centralizar mapa ruta→permiso (`src/utils/rutaPermisos.js`) reutilizado por App.jsx y DashboardLayout; aplicar en todas las rutas. `SuperAdminRoute` con `<Navigate>`. Build OK.
- [x] **2.2 Fix redirects por rol** — Alertas.jsx y Empleados.jsx (protección por permiso en vez de redirect). Tabs de Empleados con `permiso` (`empleados:ver/asistencia/pagosSalario/pagosSalario`), botones `empleados:gestionar`/`empleados:pagosSalario`.
- [x] **2.3 Botones por permiso** — Configuracion (`configuracion:editar`; ruta → `configuracion:ver` lectura), DetallePrestamo (`prestamos:desembolsar/refinanciar/cancelar`), Perfil empresa (`configuracion:editar`), Prestamos tab solicitudes (`prestamos:revisar`), Rutas (`rutas:crear/asignar/eliminar`), CierreCaja (`caja:ajuste` resumen global + `caja:abrir/cerrar`), Finanzas (`finanzas:inyeccionCapital/retiroGanancias`), Pagos (panel registrar → `pagos:registrar`), Clientes (`clientes:crear/editar/desactivar`), Gastos (`gastos:crear/editar/eliminar`), ControlCajas (cerrar → `caja:ajuste`), Usuario (`usuarios:gestionar`), Dashboard/QuickActions (`puedeVerRuta`), ClienteQuickActions (registrar pago → `pagos:registrar`).
- [x] **2.4 `authVersion` web** — AuthContext: `aplicarUsuario()` centraliza `setUser` + caché + compara `authVersion` en cada `/auth/me` (init, background, visibility, refreshUser); si cambió emite `window` `permisos-cambiaros`. DashboardLayout escucha el evento y muestra aviso "permisos actualizados".
- [x] **Verificación Fase 2** — `npm run build` OK tras cada subfase; sin errores eslint nuevos (solo preexistentes en archivos no tocados).

## Fase 3 — Móvil: UX y coherencia (`mobile/`) ✅ COMPLETA

- [x] **3.1 Caja** — `caja/_layout.tsx` gate `caja:ver` (antes `pagos:registrar`); `pago.tsx` envuelto en `PermisoGate permiso="pagos:registrar"`; `activas.tsx` botón "Cerrar Caja" → `caja:ajuste`; `index.tsx` "Control de Cajas" y badge → `caja:ajuste`.
- [x] **3.2 Stack Pagos** — `app/(app)/pagos/_layout.tsx` con `PermisoGate modulo="PAGOS" permiso="pagos:ver"`.
- [x] **3.3 `sincronizacion.tsx`** — envuelto en `PermisoGate modulo="SYNC"`.
- [x] **3.4 Botones por permiso** — `clientes/[id].tsx` desactivar/reactivar → `clientes:editar`/`clientes:desactivar` (antes `isAdmin`); `rutas/index.tsx` crear/eliminar/asignar → `rutas:crear/eliminar/asignar`; `rutas/[id].tsx` Gestión → `rutas:asignar` (prop `isAdmin` eliminada); caja Control de Cajas → `caja:ajuste`; `perfil.tsx` empresa → `configuracion:editar`; `admin/configuracion.tsx` edición → `configuracion:editar` (read-only banner + inputs).
- [x] **3.5 Quick actions dashboard** — `quick-actions.tsx` filtra por permiso (`pagos:registrar`, `clientes:crear`, `prestamos:crear`, `rutas:ver`); `upcoming-collections.tsx` item → `pagos:ver`, "Ver todos los cobros" → `pagos:registrar`.
- [x] **3.6 Deep-link ↔ drawer** — `SinAcceso` interno en las 9 pantallas `admin/*` añadiendo `tienePermiso` al gate existente (`moduloHabilitado` + permiso por pantalla). `company-header.tsx` toggle del drawer visible por permisos admin (no por rol).
- [x] **3.7 `authVersion` móvil** — campo `authVersion` en `User`; hook `useAuthVersionSync` re-consulta `/auth/me` al montar y al volver a primer plano (AppState); si cambió, actualiza store + caché y muestra toast "Tus permisos fueron actualizados". Montado en `app/_layout.tsx` dentro de `ToastProvider`.
- [x] **Verificación Fase 3** — `tsc --noEmit` sin errores nuevos (los restantes son preexistentes en tests/hooks) y `jest` 184/184 OK.

## Fase 4 — Consolidación del modelo ✅ COMPLETA

- [x] **4.1** Mapas centralizados: web `src/utils/rutaPermisos.js` (ya central); móvil `PERMISO_POR_PANTALLA` en `mobile/src/permisos/permisos.ts` usado por el drawer `_layout.tsx` y `company-header.tsx` (se elimina la duplicación de permisos hardcodeados). Gates de deep-link añadidos a `clientes/crear.tsx` (`clientes:crear`) y `prestamos/nuevo.tsx` (`prestamos:crear`).
- [x] **4.2** Revisión espejo catálogo: todos los permisos usados en móvil existen en el catálogo backend. Eliminados los retirados (`pagos:revertir`, `reportes:ver`, `alertas:gestionar`) de los label maps de web (`Permisos.jsx`) y móvil (`admin/permisos/[id].tsx`).
- [x] **4.3** Documentación del catálogo: decisiones documentadas en `permisos.constants.ts` (set base por rol, permisos retirados sin endpoint, SUPERADMIN bypass en F2). Comentarios añadidos en el espejo móvil (`permisos.ts`).

## Fase 5 — Cierre de brechas backend + móvil ✅ COMPLETA

- [x] **5.1 `perfil.controller.ts`** — `PUT /perfil/empresa`: `@Roles('ADMIN')` → `('ADMIN','EMPLEADO')` + `@Modulo('CONFIGURACION')` + `@RequierePermiso('configuracion:editar')` (espejo de `ConfiguracionController`). Un EMPLEADO con el permiso ya no recibe 403.
- [x] **5.2 `prestamos.controller.ts`** — `GET /prestamos/solicitudes`: `@Roles('ADMIN')` → `('ADMIN','EMPLEADO')` + `@RequierePermiso('prestamos:revisar')`.
- [x] **5.3 `superadmin.service.ts`** — `actualizarLimites`: al cambiar `modulosDeshabilitados` o `activo`, hace bump de `authVersion` (updateMany a usuarios de la empresa) e invalida caché `limites:modulos:*` → clientes refrescan módulos/permisos sin re-login.
- [x] **5.4 `usuario.service.ts`** — `actualizarPermisos` llama `invalidarPermisos(usuarioId, authVersionAnterior)` tras el bump (higiene de caché `perm:efectivos:*`).
- [x] **5.5 Móvil: botones por permiso** — `gastos.tsx` (`gastos:crear/editar/eliminar`), `empleados.tsx` (`empleados:gestionar` nuevo/editar/toggle, `empleados:asistencia` quick, `empleados:pagosSalario` pagos/descuentos), `usuarios.tsx` (`usuarios:gestionar` nuevo/editar/toggle/permisos, `usuarios:resetPassword` reset), `estado-financiero.tsx` (`finanzas:inyeccionCapital`/`finanzas:retiroGanancias`), `clientes/index.tsx` FAB y EmptyState (`clientes:crear`), `prestamos/index.tsx` FAB y EmptyState (`prestamos:crear`).
- [x] **5.6 Móvil: push notifications** — `use-push-notifications.ts`: registro de push token por `alertas:ver` (antes solo rol ADMIN/SUPERADMIN); SUPERADMIN sigue con bypass vía `puedeAcceder`.
- [x] **Decisión** — `POST /prestamos/moras/actualizar` se mantiene `@Roles('ADMIN')` (intencional, confirmado por usuario).
- [x] **Verificación Fase 5** — backend `tsc --noEmit` OK · `nest build` OK · jest **58/58** (3 tests nuevos); móvil `tsc --noEmit` sin errores nuevos · jest **184/184** · `expo lint` sin errores nuevos (persiste solo el error preexistente `caja/pago.tsx:74` rules-of-hooks).

---

## Fase 6 — Certificación de la barrera de permisos (backend + móvil) ✅ COMPLETA

Objetivo: cerrar los hallazgos abiertos de Fase 5 y validar el sistema de permisos en runtime contra la base de datos real (no solo análisis estático).

- [x] **6.1 `admin/permisos/[id].tsx` (móvil)** — el gate interno exigía solo `moduloHabilitado('USUARIOS')`; ahora exige **también** `tienePermiso('usuarios:gestionar')` (línea 187). El botón "Guardar permisos" se envuelve en `{tienePermiso('usuarios:gestionar') && (...)}` como defensa visual.
- [x] **6.2 `caja/pago.tsx` (móvil)** — corregido `rules-of-hooks`: el `useCallback` `afterPayment` se movió arriba, antes de los early returns (`if (isLoading || loadingCaja)`). Resultado: `expo lint` pasa a **0 errores** (antes 1 preexistente).
- [x] **6.3 Decisión `reportes/cliente/:id`** — se mantiene `@RequierePermiso('pagos:ver')`: es un endpoint **compartido** (estado de cuenta usado por 4 llamadores: `clientes.api.ts:55`, `reportes.api.ts:56`, `EstadoCuenta.jsx:79`, `Reportes.jsx:191`). Cambiarlo a otro permiso rompería el estado de cuenta. Falso positivo documentado.
- [x] **6.4 Suite E2E nueva — `backend/test/permisos.e2e-spec.ts`** (57 tests). Corre contra la **misma `DATABASE_URL`** del `.env` con aislamiento total (prefijo `perm-e2e-*`, limpieza en `afterAll`, verificado: 0 registros residuales).
  - Setup aislado: empresa + configuración + `LimiteEmpresa` + 4 usuarios (SUPERADMIN global, ADMIN, EMPLEADO base, EMPLEADO restringido a `clientes:ver` vía `permisosNegados`). `ThrottlerGuard` sobreescrito para no depender de rate-limit.
  - Matriz **200/403** por permiso efectivo: ADMIN (todos), EMPLEADO base (accesos permitidos + 15 negaciones `PERMISO_DENEGADO`), EMPLEADO restringido (6 negaciones + `sync/cambios` por rol sin permiso), SUPERADMIN (bloqueado en negocio, activo en panel).
  - **MODULO_DESACTIVADO**: al deshabilitar `CLIENTES` vía Super Admin, ADMIN y EMPLEADO reciben 403 con `code: 'MODULO_DESACTIVADO'`; al reactivar, vuelve 200.
  - **Propagación `authVersion`**: deshabilitar/reactivar módulo incrementa `authVersion` (verificado vía `/auth/me` con el token viejo). Otorgar `pagos:ver` a un usuario restringido propaga el permiso y habilita `GET /pagos` sin re-login.
  - **SUPERADMIN bloqueado**: `GET /clientes` → 403 (SuperAdminGuard); `GET /superadmin/empresas` → 200.
  - Mock de `expo-server-sdk` (ESM) para poder arrancar `AppModule` completo en Jest.
- [x] **6.5 `app.e2e-spec.ts` (scaffold)** — se le añadió el mismo mock de `expo-server-sdk` y `afterEach(app.close())`; ya no falla al importar `AppModule`.

## Fase 7 — Mejora UI/UX de la matriz de permisos (móvil) ✅ COMPLETA

Objetivo: arreglar la navegación de vuelta desde la pantalla de Permisos y hacer la agrupación por módulo más clara, sin cambiar la lógica de guardado ni el resto de screens admin.

- [x] **7.1 Volver → Usuarios (antes caía al Dashboard)** — `PageHeader` (`src/components/ui/page-header.tsx`) ahora acepta `onBack?: () => void` opcional (default `router.back()` → los otros 8 screens que lo usan no cambian). En `admin/permisos/[id].tsx` el botón volver y el post-guardado (`handleGuardar`) navegan explícitamente a `/admin/usuarios` con `router.navigate`, independiente del historial del Drawer.
  - Causa raíz: `admin/permisos/[id]` es un **Drawer.Screen** (no un Stack) y `router.back()` seguía `backBehavior` → `(tabs)` (Dashboard).
  - Bonus: se ocultó el header nativo duplicado del Drawer para esa pantalla (`headerShown: false`) — antes se veían **dos** headers "Permisos" apilados (el nativo con hamburguesa + el `PageHeader`).
  - **Limitación conocida**: el botón físico "volver" de Android sigue cayendo al Dashboard; para cubrirlo el siguiente paso sería `backBehavior: 'history'` en el Drawer (cambio global, no aplicado).
- [x] **7.2 Cabeceras de grupo con identidad visual** — antes mostraban `label.toUpperCase()` + el código del módulo duplicado (ej. "PRÉSTAMOS PRESTAMOS 3/7"). Ahora:
  - Mapa `MODULO_ICONS` (icono Ionicons por módulo, validado por `IoniconsName = keyof typeof Ionicons.glyphMap`).
  - Cabecera: chip tintado con el icono + nombre legible ("Préstamos") + pill "x de y" coloreada según avance (todo permitido → verde, parcial → ámbar, ninguno → neutral) + barra de progreso fina bajo la cabecera.
  - Solo presentación: `grupos`, `estados`, `efectivo`, `PermisoRow` y el guardado intactos.

## Verificación global

- Backend: `npx tsc --noEmit` OK · `nest build` OK · jest **58/58** · `npm run test:e2e` **58/58** (2 suites: `app.e2e-spec` + `permisos.e2e-spec`, contra DB real, sin datos residuales).
- Web: `npm run build` OK tras Fase 4.
- Móvil: `npm test` (184/184) · `expo lint` **0 errores** (tras fix de `pago.tsx`) · `tsc --noEmit` sin errores nuevos (solo preexistentes en tests/hooks no tocados).
- Fase 7: re-verificados `tsc --noEmit` (sin errores en archivos tocados), `expo lint` (0 errores) y jest **184/184**.
- Manual post-deploy (usuario): matriz de permisos, navegación, botones, deep-links, sync offline, authVersion, cambio de módulos por superadmin (propagación a usuarios conectados), push notifications en EMPLEADO con `alertas:ver`.

## Notas / riesgos

- El filtrado del sync reduce el payload offline → requiere re-sync tras deploy.
- Ownership de rutas: el cobrador solo marca visitas de su propia ruta.
- Retirar permisos del catálogo no borra datos; solo los oculta de la matriz.
- NO ejecutar comandos git.
