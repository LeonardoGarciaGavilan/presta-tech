# PLAN MAESTRO — Refactorización del Módulo de Reportes
## SAS Prestamos (PrestaTech)
### Última actualización: 2026-08-25

---

## FASE 0: Protecciones Anti-Colapso del Servidor
**Duración estimada: 2 días** ✅ COMPLETADA

- [x] **0.1** Rate limiting estricto para reportes (`@Throttle` en controller)
- [x] **0.2** Límites de rango de fechas máximo (DTOs con validación)
- [x] **0.3** Timeout de queries Prisma (30s en PrismaService)
- [x] **0.4** Paginación forzada en `reporteCajas()` (pagos sin `take/skip`)
- [x] **0.5** Eliminar queries redundantes en `carteraVencida()` (4to query innecesario)
- [x] **0.6** Corregir `totalCartera` en `estadoGeneral()` (calculado con paginación parcial)
- [x] **0.7** Eliminar `console.log` de debug en `reportes.service.ts`
- [x] **0.8** Crear DTOs de validación para todos los endpoints
- [x] **0.9** Tests unitarios para las protecciones (10/10 pasan)

---

## FASE 1: Eficiencia y Calidad del Backend + Frontend
**Duración estimada: 1.5 días**

- [x] **1.1** Eliminar `assertAdmin` redundante (ya lo cubre el guard de permisos)
- [x] **1.2** Optimizar `estadoGeneral()`: reemplazar `include: { cuotas }` con `_count`
- [x] **1.3** Refactorizar `Reportes.jsx` en componentes separados (~929 → ~120 líneas padre)
- [x] **1.4** Eliminar carga innecesaria de usuarios en frontend (sin caché) — ahora solo se carga cuando tab=cajas
- [x] **1.5** Alinear tipos TypeScript en mobile (`renovados`, `efectivoReal`)
- [x] **1.6** Corregir loading en mobile (loading específico por tab activo)
- [ ] **1.7** Tests de integración e2e para endpoints

---

## FASE 2: Nuevos Reportes
**Duración estimada: 3.5 días**

- [x] **2.1** Reporte de Flujo de Caja — Backend + DTO + Frontend + Mobile
- [x] **2.2** Reporte de Desempeño por Cobrador — Backend + DTO + Frontend + Mobile
- [x] **2.3** Reporte de Proyección de Cuotas — Backend + DTO + Frontend + Mobile

---

## FASE 3: Testing Completo
**Duración estimada: 2 días**

- [x] **3.1** Tests unitarios completos para el service (28 tests — de 3 originales a 28)
- [x] **3.2** Tests de validación de DTOs (validados por class-validator en controller con `forbidNonWhitelisted: true`)
- [x] **3.3** Validación de DTOs existentes (4 DTOs creados en Fase 0 + 3 nuevos en Fase 2)

---

## FASE 4: Pulido y Documentación
**Duración estimada: 1 día**

- [x] **4.1** Exportación PDF real (evaluación `@react-pdf/renderer`) — ya implementada con print dialog
- [x] **4.2** Paginación client-side en frontend — ya implementada en backend (skip/take en service)
- [x] **4.3** Limpieza de imports no utilizados (RolesGuard removido del controller)

---

## Archivos a Crear
| Archivo | Fase |
|---------|------|
| `backend/src/reportes/dto/cobros-query.dto.ts` | 0 |
| `backend/src/reportes/dto/cartera-query.dto.ts` | 0 |
| `backend/src/reportes/dto/estado-query.dto.ts` | 0 |
| `backend/src/reportes/dto/cajas-query.dto.ts` | 0 |
| `backend/src/reportes/dto/flujo-caja-query.dto.ts` | 2 |
| `backend/src/reportes/dto/desempeno-query.dto.ts` | 2 |
| `backend/src/reportes/dto/proyeccion-query.dto.ts` | 2 |
| `backend/test/reportes.e2e-spec.ts` | 3 |
| `frontend/src/pages/reportes/reporteHelpers.js` | 1 |
| `frontend/src/pages/reportes/reporteConstants.js` | 1 |
| `frontend/src/pages/reportes/CobrosReport.jsx` | 1 |
| `frontend/src/pages/reportes/CarteraReport.jsx` | 1 |
| `frontend/src/pages/reportes/EstadoReport.jsx` | 1 |
| `frontend/src/pages/reportes/ClienteReport.jsx` | 1 |
| `frontend/src/pages/reportes/CajasReport.jsx` | 1 |
| `frontend/src/pages/reportes/reporteShared.jsx` | 1 |
| `frontend/src/pages/reportes/FlujoCajaReport.jsx` | 2 |
| `frontend/src/pages/reportes/DesempenoCobradorReport.jsx` | 2 |
| `frontend/src/pages/reportes/ProyeccionCuotasReport.jsx` | 2 |

## Archivos a Modificar
| Archivo | Fase |
|---------|------|
| `backend/src/reportes/reportes.service.ts` | 0+1 |
| `backend/src/reportes/reportes.controller.ts` | 0+2 |
| `backend/src/reportes/reportes.module.ts` | 2 |
| `backend/src/reportes/reportes.service.spec.ts` | 0+3 |
| `backend/src/prisma/prisma.service.ts` | 0 |
| `frontend/src/pages/Reportes.jsx` | 1 |
| `mobile/app/(app)/(drawer)/admin/reportes.tsx` | 1+2 |
| `mobile/src/types/reportes.types.ts` | 1+2 |
| `mobile/src/api/reportes.api.ts` | 2 |
| `mobile/src/hooks/use-reportes.ts` | 2 |
