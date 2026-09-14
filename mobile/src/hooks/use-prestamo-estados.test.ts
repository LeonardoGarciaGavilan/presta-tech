import { obtenerAccionesPorEstado } from './use-prestamo-estados';

const colores = { info: '#i', success: '#s', error: '#e', primary: '#p' };

describe('obtenerAccionesPorEstado', () => {
  it('SOLICITADO: ofece revisar y rechazar solo con permiso de revisar', () => {
    const acciones = obtenerAccionesPorEstado({
      estado: 'SOLICITADO',
      puedeRevisar: true,
      puedeAprobar: false,
      puedeDesembolsar: false,
      colores,
    });
    expect(acciones.map((a) => a.tipo)).toEqual(['rechazar', 'revisar']);
    expect(acciones.find((a) => a.tipo === 'revisar')?.esPrimaria).toBe(true);
  });

  it('SOLICITADO sin permisos de flujo no muestra acciones', () => {
    const acciones = obtenerAccionesPorEstado({
      estado: 'SOLICITADO',
      puedeRevisar: false,
      puedeAprobar: false,
      puedeDesembolsar: false,
      colores,
    });
    expect(acciones).toEqual([]);
  });

  it('EN_REVISION: rechazar (revisar) + aprobar (aprobar)', () => {
    const acciones = obtenerAccionesPorEstado({
      estado: 'EN_REVISION',
      puedeRevisar: true,
      puedeAprobar: true,
      puedeDesembolsar: false,
      colores,
    });
    expect(acciones.map((a) => a.tipo)).toEqual(['rechazar', 'aprobar']);
    expect(acciones.find((a) => a.tipo === 'aprobar')?.esPrimaria).toBe(true);
  });

  it('APROBADO: rechazar + desembolsar cuando el usuario puede desembolsar', () => {
    const acciones = obtenerAccionesPorEstado({
      estado: 'APROBADO',
      puedeRevisar: true,
      puedeAprobar: false,
      puedeDesembolsar: true,
      colores,
    });
    expect(acciones.map((a) => a.tipo)).toEqual(['rechazar', 'desembolsar']);
    expect(acciones.find((a) => a.tipo === 'desembolsar')?.esPrimaria).toBe(true);
  });

  it('APROBADO sin permiso de desembolsar ni revisar no muestra acciones', () => {
    const acciones = obtenerAccionesPorEstado({
      estado: 'APROBADO',
      puedeRevisar: false,
      puedeAprobar: false,
      puedeDesembolsar: false,
      colores,
    });
    expect(acciones).toEqual([]);
  });
});