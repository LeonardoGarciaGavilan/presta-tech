import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Fuente (uso único): DannyFeliz/Datos-Rep-Dom — parseo del Excel oficial de la ONE.
// Los SQL se consultan una sola vez para generar el seed; el JSON resultante se commitea.
const REF =
  process.env.DATOS_REP_DOM_REF ?? 'fec319bb8a633494a2be6c58564c1c7a913b4e95';
const BASE = `https://raw.githubusercontent.com/DannyFeliz/Datos-Rep-Dom/${REF}/MySql`;

const TABLAS = [
  'provincias',
  'municipios',
  'distritos',
  'secciones',
  'barrios',
  'sub_barrios',
] as const;

const CONTEO_ESPERADO = {
  provincias: 32,
  municipios: 158,
  distritos: 235,
  secciones: 1599,
  barrios: 12813,
  sub_barrios: 5786,
};

const SECCIONES_SIN_DISTRITO_ESPERADAS = 682;

type Fila = (string | null)[];

/** Tokeniza las tuplas de un dump de Adminer (una fila por línea). */
function parseSql(sql: string): Fila[] {
  const filas: Fila[] = [];
  let enInsert = false;
  for (const linea of sql.split('\n')) {
    const l = linea.trimEnd();
    if (l.startsWith('INSERT INTO')) {
      enInsert = true;
      continue;
    }
    if (!enInsert || !l.startsWith('(')) continue;
    const tokens = l.match(/'(?:[^']|'')*'|\d+|NULL/g);
    if (!tokens) continue;
    const fila: Fila = tokens.map((t) => {
      if (t === 'NULL') return null;
      return t.startsWith("'") ? t.slice(1, -1).replace(/''/g, "'") : t;
    });
    filas.push(fila);
  }
  return filas;
}

function normalizar(nombre: string, marcadores: RegExp[]): string {
  let s = nombre.trim().replace(/\s+/g, ' ');
  for (const re of marcadores) {
    s = s.replace(re, '').trim();
  }
  return s.replace(/\s+\)$/g, ')');
}

async function descargar(tabla: string): Promise<string> {
  const res = await fetch(`${BASE}/${tabla}.sql`);
  if (!res.ok)
    throw new Error(`No se pudo descargar ${tabla}.sql (HTTP ${res.status})`);
  return res.text();
}

async function main() {
  console.log(
    `Descargando tablas desde DannyFeliz/Datos-Rep-Dom @ ${REF.slice(0, 7)}…`,
  );
  const sqlPorTabla = new Map<string, string>();
  for (const tabla of TABLAS) {
    sqlPorTabla.set(tabla, await descargar(tabla));
  }

  const provincias = parseSql(sqlPorTabla.get('provincias')!);
  const municipios = parseSql(sqlPorTabla.get('municipios')!);
  const distritos = parseSql(sqlPorTabla.get('distritos')!);
  const secciones = parseSql(sqlPorTabla.get('secciones')!);
  const barrios = parseSql(sqlPorTabla.get('barrios')!);
  const sub_barrios = parseSql(sqlPorTabla.get('sub_barrios')!);

  // Validar conteos
  const conteos = {
    provincias: provincias.length,
    municipios: municipios.length,
    distritos: distritos.length,
    secciones: secciones.length,
    barrios: barrios.length,
    sub_barrios: sub_barrios.length,
  };
  for (const clave of TABLAS) {
    if (conteos[clave] !== CONTEO_ESPERADO[clave]) {
      throw new Error(
        `Conteo inesperado en ${clave}: ${conteos[clave]} (esperado ${CONTEO_ESPERADO[clave]})`,
      );
    }
  }

  // Validar integridad referencial y normalizar nombres
  const idProv = new Set(provincias.map((r) => r[0]));
  const idMun = new Set(municipios.map((r) => r[0]));
  const idDist = new Set(distritos.map((r) => r[0]));
  const idSec = new Set(secciones.map((r) => r[0]));
  const idBar = new Set(barrios.map((r) => r[0]));

  for (const r of municipios) {
    if (!r[1] || !idProv.has(r[1]))
      throw new Error(`Municipio ${r[0]} sin provincia válida`);
  }
  for (const r of distritos) {
    if (!r[2] || !idMun.has(r[2]))
      throw new Error(`Distrito ${r[0]} sin municipio válido`);
  }
  let sinDistrito = 0;
  for (const r of secciones) {
    if (!r[2] || !idMun.has(r[2]))
      throw new Error(`Sección ${r[0]} sin municipio válido`);
    if (r[3] === null) sinDistrito += 1;
    else if (!idDist.has(r[3]))
      throw new Error(`Sección ${r[0]} con distrito inválido`);
  }
  if (sinDistrito !== SECCIONES_SIN_DISTRITO_ESPERADAS) {
    throw new Error(
      `Secciones sin distrito: ${sinDistrito} (esperado ${SECCIONES_SIN_DISTRITO_ESPERADAS})`,
    );
  }
  for (const r of barrios) {
    if (!r[2] || !idSec.has(r[2]))
      throw new Error(`Barrio ${r[0]} sin sección válida`);
  }
  for (const r of sub_barrios) {
    if (!r[2] || !idBar.has(r[2]))
      throw new Error(`Sub-barrio ${r[0]} sin barrio válido`);
  }

  const sufixDM = [/\(DM\)\s*$/i];
  const sufixSeccion = [/\(Zona\s*Urbana\)\s*$/i];

  const payload = {
    fuente: {
      repo: 'DannyFeliz/Datos-Rep-Dom',
      ref: REF,
      origen:
        'Excel oficial ONE division_territorial_2021_raw.xls (parseado por el repo)',
    },
    conteos,
    provincias: provincias.map((r) => ({
      id: r[0],
      nombre: normalizar(r[1]!, []),
    })),
    municipios: municipios.map((r) => ({
      id: r[0],
      provinciaId: r[1]!,
      nombre: normalizar(r[2]!, []),
    })),
    distritos: distritos.map((r) => ({
      id: r[0],
      municipioId: r[2]!,
      nombre: normalizar(r[1]!, sufixDM),
    })),
    secciones: secciones.map((r) => ({
      id: r[0],
      municipioId: r[2]!,
      distritoId: r[3],
      nombre: normalizar(r[1]!, sufixSeccion),
    })),
    barrios: barrios.map((r) => ({
      id: r[0],
      seccionId: r[2]!,
      nombre: normalizar(r[1]!, []),
    })),
    sub_barrios: sub_barrios.map((r) => ({
      id: r[0],
      barrioId: r[2]!,
      nombre: normalizar(r[1]!, []),
    })),
  };

  const version = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
  const dataset = {
    version,
    generadoEn: new Date().toISOString(),
    ...payload,
  };

  const out = join(process.cwd(), 'prisma', 'seed-data', 'ubicaciones-rd.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(dataset, null, 2) + '\n');

  console.log('Conteos OK:', JSON.stringify(conteos));
  console.log(
    `JSON generado (${(Buffer.byteLength(JSON.stringify(dataset)) / 1024 / 1024).toFixed(2)} MB): ${out}`,
  );
  console.log(`version: ${version}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
