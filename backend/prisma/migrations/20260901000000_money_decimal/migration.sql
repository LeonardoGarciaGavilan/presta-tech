-- Convert money columns from DOUBLE PRECISION to NUMERIC(14,2) for exact decimal arithmetic.
-- Existing float values are cast losslessly to the new type via col::numeric(14,2).

-- LimiteEmpresa
ALTER TABLE "LimiteEmpresa" ALTER COLUMN "maxMontoPorPrestamo" TYPE NUMERIC(14,2) USING "maxMontoPorPrestamo"::numeric(14,2);

-- Cliente
ALTER TABLE "Cliente" ALTER COLUMN "ingresos" TYPE NUMERIC(14,2) USING "ingresos"::numeric(14,2);

-- Prestamo
ALTER TABLE "Prestamo" ALTER COLUMN "monto" TYPE NUMERIC(14,2) USING "monto"::numeric(14,2);
ALTER TABLE "Prestamo" ALTER COLUMN "montoTotal" TYPE NUMERIC(14,2) USING "montoTotal"::numeric(14,2);
ALTER TABLE "Prestamo" ALTER COLUMN "saldoPendiente" TYPE NUMERIC(14,2) USING "saldoPendiente"::numeric(14,2);
ALTER TABLE "Prestamo" ALTER COLUMN "cuotaMensual" TYPE NUMERIC(14,2) USING "cuotaMensual"::numeric(14,2);
ALTER TABLE "Prestamo" ALTER COLUMN "moraAcumulada" TYPE NUMERIC(14,2) USING "moraAcumulada"::numeric(14,2);

-- Cuota
ALTER TABLE "Cuota" ALTER COLUMN "monto" TYPE NUMERIC(14,2) USING "monto"::numeric(14,2);
ALTER TABLE "Cuota" ALTER COLUMN "capital" TYPE NUMERIC(14,2) USING "capital"::numeric(14,2);
ALTER TABLE "Cuota" ALTER COLUMN "interes" TYPE NUMERIC(14,2) USING "interes"::numeric(14,2);
ALTER TABLE "Cuota" ALTER COLUMN "mora" TYPE NUMERIC(14,2) USING "mora"::numeric(14,2);

-- Pago
ALTER TABLE "Pago" ALTER COLUMN "montoTotal" TYPE NUMERIC(14,2) USING "montoTotal"::numeric(14,2);
ALTER TABLE "Pago" ALTER COLUMN "capital" TYPE NUMERIC(14,2) USING "capital"::numeric(14,2);
ALTER TABLE "Pago" ALTER COLUMN "interes" TYPE NUMERIC(14,2) USING "interes"::numeric(14,2);
ALTER TABLE "Pago" ALTER COLUMN "mora" TYPE NUMERIC(14,2) USING "mora"::numeric(14,2);

-- Configuracion
ALTER TABLE "Configuracion" ALTER COLUMN "montoMaximoPago" TYPE NUMERIC(14,2) USING "montoMaximoPago"::numeric(14,2);
ALTER TABLE "Configuracion" ALTER COLUMN "montoMaximoPrestamo" TYPE NUMERIC(14,2) USING "montoMaximoPrestamo"::numeric(14,2);
ALTER TABLE "Configuracion" ALTER COLUMN "montoMinimoPrestamo" TYPE NUMERIC(14,2) USING "montoMinimoPrestamo"::numeric(14,2);

-- Auditoria
ALTER TABLE "Auditoria" ALTER COLUMN "monto" TYPE NUMERIC(14,2) USING "monto"::numeric(14,2);

-- Gasto
ALTER TABLE "Gasto" ALTER COLUMN "monto" TYPE NUMERIC(14,2) USING "monto"::numeric(14,2);

-- CajaSesion
ALTER TABLE "CajaSesion" ALTER COLUMN "montoInicial" TYPE NUMERIC(14,2) USING "montoInicial"::numeric(14,2);
ALTER TABLE "CajaSesion" ALTER COLUMN "montoCierre" TYPE NUMERIC(14,2) USING "montoCierre"::numeric(14,2);
ALTER TABLE "CajaSesion" ALTER COLUMN "diferencia" TYPE NUMERIC(14,2) USING "diferencia"::numeric(14,2);
ALTER TABLE "CajaSesion" ALTER COLUMN "efectivoReal" TYPE NUMERIC(14,2) USING "efectivoReal"::numeric(14,2);
ALTER TABLE "CajaSesion" ALTER COLUMN "efectivoSistema" TYPE NUMERIC(14,2) USING "efectivoSistema"::numeric(14,2);
ALTER TABLE "CajaSesion" ALTER COLUMN "totalEgresos" TYPE NUMERIC(14,2) USING "totalEgresos"::numeric(14,2);
ALTER TABLE "CajaSesion" ALTER COLUMN "totalIngresos" TYPE NUMERIC(14,2) USING "totalIngresos"::numeric(14,2);

-- DesembolsoCaja
ALTER TABLE "DesembolsoCaja" ALTER COLUMN "monto" TYPE NUMERIC(14,2) USING "monto"::numeric(14,2);

-- Empleado
ALTER TABLE "Empleado" ALTER COLUMN "salario" TYPE NUMERIC(14,2) USING "salario"::numeric(14,2);

-- PagoSalario
ALTER TABLE "PagoSalario" ALTER COLUMN "salarioBruto" TYPE NUMERIC(14,2) USING "salarioBruto"::numeric(14,2);
ALTER TABLE "PagoSalario" ALTER COLUMN "totalDescuentos" TYPE NUMERIC(14,2) USING "totalDescuentos"::numeric(14,2);
ALTER TABLE "PagoSalario" ALTER COLUMN "salarioNeto" TYPE NUMERIC(14,2) USING "salarioNeto"::numeric(14,2);

-- DescuentoEmpleado
ALTER TABLE "DescuentoEmpleado" ALTER COLUMN "monto" TYPE NUMERIC(14,2) USING "monto"::numeric(14,2);

-- CapitalEmpresa
ALTER TABLE "CapitalEmpresa" ALTER COLUMN "capitalInicial" TYPE NUMERIC(14,2) USING "capitalInicial"::numeric(14,2);

-- InyeccionCapital
ALTER TABLE "InyeccionCapital" ALTER COLUMN "monto" TYPE NUMERIC(14,2) USING "monto"::numeric(14,2);

-- RetiroGanancias
ALTER TABLE "RetiroGanancias" ALTER COLUMN "monto" TYPE NUMERIC(14,2) USING "monto"::numeric(14,2);

-- MovimientoFinanciero
ALTER TABLE "MovimientoFinanciero" ALTER COLUMN "monto" TYPE NUMERIC(14,2) USING "monto"::numeric(14,2);
ALTER TABLE "MovimientoFinanciero" ALTER COLUMN "capital" TYPE NUMERIC(14,2) USING "capital"::numeric(14,2);
ALTER TABLE "MovimientoFinanciero" ALTER COLUMN "interes" TYPE NUMERIC(14,2) USING "interes"::numeric(14,2);
ALTER TABLE "MovimientoFinanciero" ALTER COLUMN "mora" TYPE NUMERIC(14,2) USING "mora"::numeric(14,2);
