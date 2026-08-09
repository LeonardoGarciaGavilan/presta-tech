import { BadRequestException } from '@nestjs/common';
import {
  validarPoliticaPassword,
  validarPasswordOPopThrow,
  generarPasswordTemporal,
} from './password-policy';

describe('PasswordPolicy (F6)', () => {
  describe('validarPoliticaPassword', () => {
    it('acepta una contraseña compleja válida', () => {
      const r = validarPoliticaPassword('Clave#2024Segura');
      expect(r.valida).toBe(true);
      expect(r.errores).toEqual([]);
    });

    it('rechaza por longitud menor a 8', () => {
      const r = validarPoliticaPassword('A1b2C3!');
      expect(r.valida).toBe(false);
      expect(r.errores).toContain(
        'La contraseña debe tener al menos 8 caracteres',
      );
    });

    it('rechaza sin mayúscula', () => {
      const r = validarPoliticaPassword('abc1234!');
      expect(r.valida).toBe(false);
      expect(r.errores).toContain('Debe incluir al menos una letra mayúscula');
    });

    it('rechaza sin número', () => {
      const r = validarPoliticaPassword('ClaveSecreta!');
      expect(r.valida).toBe(false);
      expect(r.errores).toContain('Debe incluir al menos un número');
    });

    it('rechaza sin símbolo', () => {
      const r = validarPoliticaPassword('Clave2024Segura');
      expect(r.valida).toBe(false);
      expect(r.errores).toContain('Debe incluir al menos un símbolo');
    });

    it('rechaza contraseñas comunes (insensible a mayúsculas)', () => {
      const r = validarPoliticaPassword('Password123');
      expect(r.valida).toBe(false);
      expect(r.errores).toContain(
        'Esta contraseña es muy común. Elige una más segura',
      );
    });
  });

  describe('validarPasswordOPopThrow', () => {
    it('lanza BadRequestException con la política violada', () => {
      expect(() => validarPasswordOPopThrow('abc')).toThrow(
        BadRequestException,
      );
    });

    it('no lanza con contraseña válida', () => {
      expect(() => validarPasswordOPopThrow('Clave#2024Segura')).not.toThrow();
    });
  });

  describe('generarPasswordTemporal', () => {
    it('genera contraseñas que cumplen la política', () => {
      for (let i = 0; i < 50; i++) {
        const pw = generarPasswordTemporal();
        const r = validarPoliticaPassword(pw);
        expect(r.valida).toBe(true);
        expect(pw.length).toBeGreaterThanOrEqual(8);
      }
    });

    it('genera contraseñas distintas entre sí', () => {
      const a = generarPasswordTemporal();
      const b = generarPasswordTemporal();
      expect(a).not.toBe(b);
    });
  });
});
