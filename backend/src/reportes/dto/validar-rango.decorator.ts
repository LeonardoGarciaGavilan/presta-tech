import {
  registerDecorator,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export function ValidarRango(validators?: { maxDias?: number }) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'validarRango',
      target: object.constructor,
      propertyName,
      options: { message: 'rango_fechas_invalido' },
      validator: ValidarRangoConstraint,
      constraints: [validators?.maxDias ?? 366],
    });
  };
}

const getRango = (
  args: ValidationArguments,
): { maxDias: number; desde?: string; hasta?: string } => {
  const maxDias = (args.constraints as number[])[0] ?? 366;
  const objeto = args.object as Record<string, string | undefined>;
  return { maxDias, desde: objeto['desde'], hasta: objeto['hasta'] };
};

@ValidatorConstraint({ name: 'validarRango', async: false })
export class ValidarRangoConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const { maxDias, desde, hasta } = getRango(args);

    if (typeof desde !== 'string' || typeof hasta !== 'string') {
      return true; // deja que @IsDateString reporte si están mal formadas
    }
    if (!desde || !hasta) return true; // opcional sin validar
    if (desde > hasta) return false; // 'desde' y 'hasta' son YYYY-MM-DD (lexicográfico válido)

    const diffMs =
      new Date(hasta + 'T00:00:00Z').getTime() -
      new Date(desde + 'T00:00:00Z').getTime();
    const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (dias < 0) return false;
    if (dias > maxDias) return false;
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const { maxDias, desde, hasta } = getRango(args);
    if (desde && hasta && desde > hasta) {
      return 'La fecha "desde" no puede ser posterior a "hasta"';
    }
    return `El rango de fechas no puede exceder ${maxDias} días`;
  }
}
