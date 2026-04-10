// src/common/utils/auditoria.utils.ts

interface AuditoriaData {
  empresaId?: string | null;
  usuarioId?: string;
  tipo?: string;
  accion: string;
  descripcion?: string;
  monto?: number;
  referenciaId?: string;
  referenciaTipo?: string;
  datosAnteriores?: Record<string, any> | null;
  datosNuevos?: Record<string, any> | null;
  ip?: string | null;
  userAgent?: string | null;
  nivel?: 'INFO' | 'WARN' | 'ERROR' | null;
}

export async function registrarAuditoria(prisma: any, data: AuditoriaData): Promise<any | null> {
  try {
    if (!data.usuarioId) {
      console.warn('⚠️ Auditoría sin usuarioId:', data.accion, data.descripcion);
    }

    // Validar que empresaId sea válido si se proporciona
    let empresaIdValida: string | null = null;
    
    if (data.empresaId) {
      // Verificar que la empresa existe en la base de datos
      const empresaExiste = await prisma.empresa.findUnique({
        where: { id: data.empresaId },
        select: { id: true },
      });
      
      if (empresaExiste) {
        empresaIdValida = data.empresaId;
      } else {
        console.warn(`⚠️ Auditoría: empresaId "${data.empresaId}" no existe, se guardará como null`);
      }
    }

    const dataToSave: any = {
      empresaId: empresaIdValida,
      usuarioId: data.usuarioId ?? null,
      tipo: data.tipo ?? null,
      accion: data.accion,
      descripcion: data.descripcion ?? null,
      monto: data.monto ?? null,
      referenciaId: data.referenciaId ?? null,
      referenciaTipo: data.referenciaTipo ?? null,
      datosAnteriores: data.datosAnteriores ?? null,
      datosNuevos: data.datosNuevos ?? null,
      ip: data.ip ?? null,
      userAgent: data.userAgent ?? null,
      nivel: data.nivel ?? 'INFO',
    };

    return await prisma.auditoria.create({
      data: dataToSave,
    });
  } catch (error) {
    console.error('Error auditoría:', error);
    return null;
  }
}

export function generarDescripcionCambios(antes: Record<string, any> | null, despues: Record<string, any>): string {
  const cambios: string[] = [];
  const camposRelevantes = [
    'tasaInteresBase',
    'moraPorcentajeMensual',
    'diasGracia',
    'permitirAbonoCapital',
    'montoMinimoPrestamo',
    'montoMaximoPrestamo',
    'montoMaximoPago'
  ];

  for (const campo of camposRelevantes) {
    const valorAntes = antes?.[campo];
    const valorDespues = despues[campo];

    if (valorAntes !== valorDespues) {
      const label = campo
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());

      cambios.push(`${label}: ${valorAntes ?? '—'} → ${valorDespues ?? '—'}`);
    }
  }

  return cambios.length > 0 ? cambios.join(' | ') : 'Sin cambios detectados';
}