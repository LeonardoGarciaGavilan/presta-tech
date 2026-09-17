import { PrismaClient, TipoUbicacion } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Seed idempotente del catálogo central de ubicaciones de RD.
 * Lee backend/prisma/seed-data/ubicaciones-rd.json (generado por build:ubicaciones)
 * y lo vuelca en las tablas Ubicacion / UbicacionVersion.
 * Se puede re-ejecutar sin riesgo: updates por id cuando existe, creates si falta.
 */

type FilaProvincia = { id: string; nombre: string };
type FilaMunicipio = { id: string; provinciaId: string; nombre: string };
type FilaDistrito = { id: string; municipioId: string; nombre: string };
type FilaSeccion = {
  id: string;
  municipioId: string;
  distritoId: string | null;
  nombre: string;
};
type FilaBarrio = { id: string; seccionId: string; nombre: string };
type FilaSubBarrio = { id: string; barrioId: string; nombre: string };

interface DatasetUbicaciones {
  version: string;
  conteos: Record<string, number>;
  provincias: FilaProvincia[];
  municipios: FilaMunicipio[];
  distritos: FilaDistrito[];
  secciones: FilaSeccion[];
  barrios: FilaBarrio[];
  sub_barrios: FilaSubBarrio[];
}

type FilaUbicacion = {
  id: string;
  codigoOrigen: number;
  nombre: string;
  tipo: TipoUbicacion;
  padreId: string | null;
  unidadPadreId: string | null;
  provinciaId: string | null;
  municipioId: string | null;
  municipioNombre: string | null;
};

const CONCURRENCIA = 8;

const prisma = new PrismaClient();

const DATASET_PATH = join(
  process.cwd(),
  'prisma/seed-data/ubicaciones-rd.json',
);

async function runConConcurrencia<T>(
  items: T[],
  concurrencia: number,
  task: (item: T) => Promise<unknown>,
): Promise<number> {
  let idx = 0;
  const workers = Array.from(
    { length: Math.min(concurrencia, items.length) },
    async () => {
      while (idx < items.length) {
        const item = items[idx++];
        await task(item);
      }
    },
  );
  await Promise.all(workers);
  return items.length;
}

async function main(): Promise<void> {
  const dataset: DatasetUbicaciones = JSON.parse(
    readFileSync(DATASET_PATH, 'utf8'),
  ) as DatasetUbicaciones;

  const municipioById = new Map(dataset.municipios.map((m) => [m.id, m]));
  const provinciaDeMunicipio = (municipioId: string): string =>
    `PROVINCIA:${municipioById.get(municipioId)?.provinciaId ?? ''}`;

  const filas: FilaUbicacion[] = [];

  for (const p of dataset.provincias) {
    filas.push({
      id: `PROVINCIA:${p.id}`,
      codigoOrigen: Number(p.id),
      nombre: p.nombre,
      tipo: 'PROVINCIA',
      padreId: null,
      unidadPadreId: null,
      provinciaId: null,
      municipioId: null,
      municipioNombre: null,
    });
  }

  for (const m of dataset.municipios) {
    filas.push({
      id: `MUNICIPIO:${m.id}`,
      codigoOrigen: Number(m.id),
      nombre: m.nombre,
      tipo: 'MUNICIPIO',
      padreId: `PROVINCIA:${m.provinciaId}`,
      unidadPadreId: null,
      provinciaId: `PROVINCIA:${m.provinciaId}`,
      municipioId: `MUNICIPIO:${m.id}`,
      municipioNombre: null,
    });
  }

  for (const d of dataset.distritos) {
    const municipio = municipioById.get(d.municipioId);
    filas.push({
      id: `DISTRITO_MUNICIPAL:${d.id}`,
      codigoOrigen: Number(d.id),
      nombre: d.nombre,
      tipo: 'DISTRITO_MUNICIPAL',
      padreId: `MUNICIPIO:${d.municipioId}`,
      unidadPadreId: null,
      provinciaId: provinciaDeMunicipio(d.municipioId),
      municipioId: `MUNICIPIO:${d.municipioId}`,
      municipioNombre: municipio?.nombre ?? null,
    });
  }

  for (const s of dataset.secciones) {
    const padreId = s.distritoId
      ? `DISTRITO_MUNICIPAL:${s.distritoId}`
      : `MUNICIPIO:${s.municipioId}`;
    const unidadPadreId = s.distritoId
      ? `DISTRITO_MUNICIPAL:${s.distritoId}`
      : `MUNICIPIO:${s.municipioId}`;
    filas.push({
      id: `SECCION:${s.id}`,
      codigoOrigen: Number(s.id),
      nombre: s.nombre,
      tipo: 'SECCION',
      padreId,
      unidadPadreId,
      provinciaId: provinciaDeMunicipio(s.municipioId),
      municipioId: `MUNICIPIO:${s.municipioId}`,
      municipioNombre: municipioById.get(s.municipioId)?.nombre ?? null,
    });
  }

  for (const b of dataset.barrios) {
    const seccion = dataset.secciones.find((s) => s.id === b.seccionId);
    const padre = seccion
      ? seccion.distritoId
        ? `DISTRITO_MUNICIPAL:${seccion.distritoId}`
        : `MUNICIPIO:${seccion.municipioId}`
      : null;
    filas.push({
      id: `BARRIO:${b.id}`,
      codigoOrigen: Number(b.id),
      nombre: b.nombre,
      tipo: 'BARRIO',
      padreId: `SECCION:${b.seccionId}`,
      unidadPadreId: padre,
      provinciaId: seccion ? provinciaDeMunicipio(seccion.municipioId) : null,
      municipioId: seccion ? `MUNICIPIO:${seccion.municipioId}` : null,
      municipioNombre: seccion
        ? (municipioById.get(seccion.municipioId)?.nombre ?? null)
        : null,
    });
  }

  for (const sb of dataset.sub_barrios) {
    const barrio = dataset.barrios.find((b) => b.id === sb.barrioId);
    const seccion = barrio
      ? dataset.secciones.find((s) => s.id === barrio.seccionId)
      : undefined;
    const unidadPadreId = seccion
      ? seccion.distritoId
        ? `DISTRITO_MUNICIPAL:${seccion.distritoId}`
        : `MUNICIPIO:${seccion.municipioId}`
      : null;
    filas.push({
      id: `SUB_BARRIO:${sb.id}`,
      codigoOrigen: Number(sb.id),
      nombre: sb.nombre,
      tipo: 'SUB_BARRIO',
      padreId: `BARRIO:${sb.barrioId}`,
      unidadPadreId,
      provinciaId: seccion ? provinciaDeMunicipio(seccion.municipioId) : null,
      municipioId: seccion ? `MUNICIPIO:${seccion.municipioId}` : null,
      municipioNombre: seccion
        ? (municipioById.get(seccion.municipioId)?.nombre ?? null)
        : null,
    });
  }

  const total = filas.length;
  const esperado = Object.values(dataset.conteos).reduce((a, b) => a + b, 0);
  if (total !== esperado) {
    throw new Error(
      `Conteo inconsistente: dataset=${esperado}, filas calculadas=${total}`,
    );
  }
  console.log(`🧭 Filas a sincronizar: ${total}`);

  await prisma.ubicacionVersion.upsert({
    where: { id: 1 },
    create: { id: 1, version: dataset.version },
    update: { version: dataset.version },
  });

  // Orden jerárquico: se procesa nivel por nivel para que las FKs de cada
  // nivel apunten a filas ya commiteadas del nivel anterior (upserts
  // individuales, compatibles con el pooler de Supabase).
  const niveles: TipoUbicacion[] = [
    'PROVINCIA',
    'MUNICIPIO',
    'DISTRITO_MUNICIPAL',
    'SECCION',
    'BARRIO',
    'SUB_BARRIO',
  ];

  let sincronizadas = 0;
  for (const tipo of niveles) {
    const delNivel = filas.filter((f) => f.tipo === tipo);
    const hecho = await runConConcurrencia(delNivel, CONCURRENCIA, (f) =>
      prisma.ubicacion.upsert({
        where: { id: f.id },
        create: f,
        update: {
          codigoOrigen: f.codigoOrigen,
          nombre: f.nombre,
          tipo: f.tipo,
          padreId: f.padreId,
          unidadPadreId: f.unidadPadreId,
          provinciaId: f.provinciaId,
          municipioId: f.municipioId,
          municipioNombre: f.municipioNombre,
        },
      }),
    );
    sincronizadas += hecho;
    console.log(`  ✔ ${tipo} ${hecho}/${delNivel.length}`);
  }

  console.log(
    `✅ Seed de ubicaciones completado (${sincronizadas}/${total} filas, versión ${dataset.version})`,
  );
}

main()
  .catch((err) => {
    console.error('❌ Error en seed-ubicaciones:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
