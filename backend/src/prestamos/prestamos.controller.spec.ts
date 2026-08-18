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
