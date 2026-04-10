import { NotFoundException, BadRequestException } from '@nestjs/common';

export class TenantUtils {
  private static getPrismaModel(tx: any, modelName: string): any {
    const model = tx[modelName];
    if (!model) {
      throw new BadRequestException(`Modelo '${modelName}' no encontrado en Prisma`);
    }
    return model;
  }

  static async findByIdOrThrow(
    tx: any,
    modelName: string,
    id: string,
    empresaId: string,
    resourceName = 'Recurso',
  ) {
    const model = this.getPrismaModel(tx, modelName);
    
    const result = await model.findFirst({
      where: { id, empresaId },
    });

    if (!result) {
      throw new NotFoundException(`${resourceName} no encontrado`);
    }

    return result;
  }

  static assertOwnership(
    recurso: { empresaId?: string } | null,
    empresaId: string,
    resourceName = 'Recurso',
  ): void {
    if (!recurso) {
      throw new NotFoundException(`${resourceName} no encontrado`);
    }

    if (recurso.empresaId && recurso.empresaId !== empresaId) {
      throw new BadRequestException('No tienes acceso a este recurso');
    }
  }

  static requireEmpresaId(empresaId: string | null | undefined): string {
    if (!empresaId) {
      throw new BadRequestException('Empresa no identificada en el token');
    }
    return empresaId;
  }
}