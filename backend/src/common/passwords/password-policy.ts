// src/common/passwords/password-policy.ts
// Política de contraseñas (F6): mínimo 8 caracteres, mayúscula, minúscula,
// número, símbolo y no común. Lógica pura y testeable.
import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { CONTRASENAS_COMUNES } from './contraenas-comunes';

export const LONGITUD_MINIMA = 8;

export interface PoliticaPasswordResultado {
  valida: boolean;
  errores: string[];
}

export function validarPoliticaPassword(
  password: string,
): PoliticaPasswordResultado {
  const errores: string[] = [];

  if (!password || password.length < LONGITUD_MINIMA) {
    errores.push(
      `La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres`,
    );
  }
  if (!/[a-z]/.test(password)) {
    errores.push('Debe incluir al menos una letra minúscula');
  }
  if (!/[A-Z]/.test(password)) {
    errores.push('Debe incluir al menos una letra mayúscula');
  }
  if (!/[0-9]/.test(password)) {
    errores.push('Debe incluir al menos un número');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errores.push('Debe incluir al menos un símbolo');
  }
  if (CONTRASENAS_COMUNES.includes(password.toLowerCase())) {
    errores.push('Esta contraseña es muy común. Elige una más segura');
  }

  return { valida: errores.length === 0, errores };
}

export function validarPasswordOPopThrow(password: string): void {
  const { valida, errores } = validarPoliticaPassword(password);
  if (!valida) throw new BadRequestException(errores.join('. '));
}

const MAYUSCULAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijklmnopqrstuvwxyz';
const NUMEROS = '0123456789';
const SIMBOLOS = '!@#$%*+-_?';
const TODOS = MAYUSCULAS + MINUSCULAS + NUMEROS + SIMBOLOS;
const LONGITUD_TEMPORAL = 12;

function elegir(set: string, n: number): string {
  return Array.from(randomBytes(n))
    .map((b) => set[b % set.length])
    .join('');
}

/** Genera una contraseña temporal que SÍ cumple la política (F6). */
export function generarPasswordTemporal(): string {
  const garantizado =
    elegir(MAYUSCULAS, 1) +
    elegir(MINUSCULAS, 1) +
    elegir(NUMEROS, 1) +
    elegir(SIMBOLOS, 1);
  const base = elegir(TODOS, LONGITUD_TEMPORAL - 4);
  const partes = (garantizado + base).split('');

  for (let i = partes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [partes[i], partes[j]] = [partes[j], partes[i]];
  }

  return partes.join('');
}
