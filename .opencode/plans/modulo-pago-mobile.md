# Plan: Módulo de Pago Mobile

## Resumen
Implementar el registro de pagos en la app mobile de SAS Préstamos, reutilizando el backend existente (NestJS) sin modificaciones.

## Archivos a crear

### 1. `mobile/src/api/pagos.api.ts`
```typescript
ENDPOINT = '/pagos'

registrarPago(dto: CreatePagoDto): Promise<PagoResponse>
obtenerPagos(prestamoId: string): Promise<Pago[]>
obtenerPago(id: string): Promise<PagoResponse>
obtenerResumenPagos(): Promise<PagosResumen>
saldarPrestamo(prestamoId: string, dto: SaldarPrestamoDto): Promise<PagoResponse>
obtenerTodosPagos(): Promise<PagoConPrestamo[]>
```

### 2. `mobile/src/types/prestamo.types.ts` — Agregar
```typescript
CreatePagoDto { prestamoId, cuotaId?, montoPagado, metodo: MetodoPago, referencia?, observacion? }
SaldarPrestamoDto { metodo: string, referencia?, observacion? }
PagosResumen { cobradoHoy, cobradoMes, pagosHoy, pagosMes }

PagoResponse {
  pago: { id, createdAt, montoTotal, capital, interes, mora, abonoCapital, pagoCompleto, metodo, referencia, observacion }
  prestamo: { id, monto, numeroCuotas, frecuenciaPago, tasaInteres, saldoPendiente }
  cliente: { nombre, apellido, cedula }
  cuota: { id, numero, monto, capital, interes, mora, fechaVencimiento, pagoCompleto } | null
  usuario: { nombre }
}
```

### 3. `mobile/src/hooks/use-pagos.ts`
- `useRegistrarPago()` — mutation, invalida `['prestamos', prestamoId]`
- `usePagosDePrestamo(prestamoId)` — query
- `usePago(id)` — query (para reimprimir)
- `useResumenPagos()` — query
- `useSaldarPrestamo()` — mutation

### 4. `mobile/app/(app)/(tabs)/prestamos/pago.tsx`
Pantalla de registro de pago con:
- Header con botón de retroceso
- Selector de cuota (PickerField con las cuotas pendientes)
- Input de monto (formateado como moneda, RD$)
- Selector de método de pago (4 opciones: EFECTIVO/TRANSFERENCIA/TARJETA/CHEQUE)
- Campos: referencia (opcional), observación (opcional)
- Resumen visual del desglose: capital → interés → mora
- Botón "Registrar Pago"
- Modal "Saldar Préstamo" (con confirmación "CONFIRMAR")
- Modal de recibo al completar

### 5. `mobile/app/(app)/pagos/_layout.tsx`
Stack layout para la sección de pagos.

### 6. `mobile/app/(app)/pagos/index.tsx`
Pantalla de gestión de pagos con:
- Búsqueda de préstamos
- Resumen: cobrado hoy / este mes
- Lista de pagos recientes
- Tap en pago → modal de recibo

### 7. `mobile/app/(app)/pagos/prestamo/[id].tsx`
Lista de pagos de un préstamo específico.

## Archivos a modificar

### 8. `mobile/app/(app)/(tabs)/prestamos/[id].tsx`
- Agregar botón "💰 Registrar Pago" en action row (visible para ACTIVO/ATRASADO)
- Navegación: `router.push(\`/prestamos/pago?prestamoId=\${prestamo.id}\`)`

### 9. `mobile/app/(app)/_layout.tsx`
- Agregar `<Stack.Screen name="pagos" />`

### 10. `mobile/app/(app)/(tabs)/prestamos/_layout.tsx`
- Agregar `<Stack.Screen name="pago" />`

## Flujo de usuario

1. Usuario abre detalle del préstamo (`/prestamos/:id`)
2. Toca "Registrar Pago" en action buttons
3. Navega a `/prestamos/pago?prestamoId=xxx`
4. Selecciona cuota (por defecto la próxima pendiente)
5. Ingresa monto (prefilled con total de cuota)
6. Selecciona método de pago
7. Opcional: referencia, observación
8. Toca "Registrar Pago"
   - Backend valida caja abierta, montos, distribuye
9. Ve modal de recibo con desglose
10. Cierra → vuelve al detalle (refresheado)

## Consideraciones

- Sin caja abierta: mostrar error del backend con instrucciones
- Pago parcial: permitir montos menores a la cuota
- Pago completo: marcar cuota como pagada
- Abono a capital: montos mayores se aplican a cuotas futuras
- Saldar: modal separado con confirmación "CONFIRMAR"
- Los métodos de pago y el flujo son idénticos al frontend web
- No se necesita tocar el backend
