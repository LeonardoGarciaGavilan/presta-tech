import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { PrestamosController } from './prestamos.controller';

jest.mock('../notificaciones/push-notifications.service', () => ({
  PushNotificationsService: class {},
}));

const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';

function patchRoutes(controller: any): string[] {
  const routes: string[] = [];
  const proto = controller.prototype;
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === 'constructor') continue;
    const method = Reflect.getMetadata(METHOD_METADATA, proto[name]);
    if (method !== RequestMethod.PATCH) continue;
    routes.push(String(Reflect.getMetadata(PATH_METADATA, proto[name])));
  }
  return routes;
}

describe('PrestamosController (2.5)', () => {
  it('no expone PATCH /prestamos/:id genérico: estado solo por transiciones dedicadas', () => {
    const routes = patchRoutes(PrestamosController);
    expect(routes).not.toContain(':id');
    expect(routes).toEqual(
      expect.arrayContaining([
        ':id/cancelar',
        ':id/estado',
        ':id/desembolsar',
        ':id/refinanciar',
      ]),
    );
  });
});

describe('PrestamosController — PATCH :id/cancelar (motivo obligatorio)', () => {
  function buildController(
    serviceMock = { cancelar: jest.fn().mockResolvedValue({ id: 'p1' }) },
  ) {
    const controller = new PrestamosController(
      serviceMock as never,
      { tienePermiso: jest.fn() } as never,
    );
    return { controller, serviceMock };
  }

  const user = { sub: 'u1' };

  it('rechaza cuando no se envía body/motivo y no llama al servicio', () => {
    const { controller, serviceMock } = buildController();

    expect(() =>
      controller.cancelar('p1', undefined as never, 'emp1', user),
    ).toThrow('El motivo de la cancelación es obligatorio');
    expect(serviceMock.cancelar).not.toHaveBeenCalled();
  });

  it('rechaza cuando el motivo viene vacío o en blanco', () => {
    const { controller, serviceMock } = buildController();

    expect(() =>
      controller.cancelar('p1', { motivo: '' }, 'emp1', user),
    ).toThrow('El motivo de la cancelación es obligatorio');
    expect(() =>
      controller.cancelar('p1', { motivo: '   ' }, 'emp1', user),
    ).toThrow();
    expect(serviceMock.cancelar).not.toHaveBeenCalled();
  });

  it('delega al servicio con motivo, empresa y usuario correctos', async () => {
    const { controller, serviceMock } = buildController();

    await controller.cancelar('p1', { motivo: 'Cliente incobrable' }, 'emp1', {
      userId: 'u2',
    });

    expect(serviceMock.cancelar).toHaveBeenCalledWith(
      'p1',
      'emp1',
      'u2',
      'Cliente incobrable',
    );
  });
});
