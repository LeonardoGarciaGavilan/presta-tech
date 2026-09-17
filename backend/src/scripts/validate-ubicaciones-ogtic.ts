import { readFileSync } from 'node:fs';

// Valida el dataset generado contra la API oficial OGTIC/ONE (api.digital.gob.do),
// que usa la División Territorial 2020 como base. Por eso las diferencias se
// reportan como INFO (no bloquean): el dataset local está actualizado a 2023.
const BASE = 'https://api.digital.gob.do/v1/territories';
const DATASET_PATH = 'prisma/seed-data/ubicaciones-rd.json';

interface Item {
  name: string;
  code?: string;
  identifier?: string;
  regionCode?: string;
  provinceCode?: string;
  municipalityCode?: string;
}

interface Diffs {
  provincias: string[];
  municipios: {
    provincia: string;
    solosDataset: string[];
    solosOptic: string[];
  }[];
  distritos: {
    municipio: string;
    solosDataset: string[];
    solosOptic: string[];
  }[];
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(dm\)\s*$/, '')
    .replace(/\(zona\s*urbana\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function get<T>(ruta: string): Promise<T> {
  const res = await fetch(`${BASE}${ruta}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} en ${ruta}`);
  }
  const json = (await res.json()) as { valid: boolean; data?: T };
  if (!json.valid) throw new Error(`Respuesta inválida en ${ruta}`);
  return json.data as T;
}

/** La API devuelve objeto cuando hay un solo resultado y lista cuando hay varios. */
function aList(data: unknown): Item[] {
  return Array.isArray(data)
    ? (data as Item[])
    : (data as Item)
      ? [data as Item]
      : [];
}

async function mapAsync<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batch = 8,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batch) {
    const chunk = items.slice(i, i + batch);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

async function main() {
  const dataset = JSON.parse(readFileSync(DATASET_PATH, 'utf8')) as {
    provincias: { id: string; nombre: string }[];
    municipios: { id: string; provinciaId: string; nombre: string }[];
    distritos: { id: string; municipioId: string; nombre: string }[];
  };

  console.log('Consultando API OGTIC/ONE…');
  const provinciasOptic = aList(await get<Item | Item[]>('/provinces'));
  const diffs: Diffs = { provincias: [], municipios: [], distritos: [] };

  // 1) Provincias
  const nombresDataset = new Map(
    dataset.provincias.map((p) => [normalizar(p.nombre), p.id]),
  );
  const opticPorNorma = new Map(
    provinciasOptic.map((p) => [normalizar(p.name), p]),
  );
  for (const p of dataset.provincias) {
    if (!opticPorNorma.has(normalizar(p.nombre))) {
      diffs.provincias.push(`Provincia en dataset (no en OGTIC): ${p.nombre}`);
    }
  }
  for (const p of provinciasOptic) {
    if (!nombresDataset.has(normalizar(p.name))) {
      diffs.provincias.push(`Provincia en OGTIC (no en dataset): ${p.name}`);
    }
  }

  // 2) Municipios y 3) distritos, recorriendo por provincia/municipio (evita el tope de 100)
  await mapAsync(provinciasOptic, async (prov) => {
    const key = normalizar(prov.name);
    const nuestroProv = nombresDataset.get(key);
    const provinciaEtiqueta = prov.name;
    if (!nuestroProv) return;

    const munsOptic = aList(
      await get<Item | Item[]>(
        `/municipalities?provinceCode=${prov.code}&regionCode=${prov.regionCode}`,
      ),
    );

    const nombresMunOptic = new Set(munsOptic.map((m) => normalizar(m.name)));
    const munsDataset = dataset.municipios
      .filter((m) => m.provinciaId === nuestroProv)
      .map((m) => normalizar(m.nombre));
    const solosDataset = munsDataset.filter((n) => !nombresMunOptic.has(n));
    const solosOptic = munsOptic
      .filter((m) => !new Set(munsDataset).has(normalizar(m.name)))
      .map((m) => m.name);
    if (solosDataset.length || solosOptic.length) {
      diffs.municipios.push({
        provincia: provinciaEtiqueta,
        solosDataset,
        solosOptic,
      });
    }

    // distritos por municipio
    const municipiosIdDataset = new Map(
      dataset.municipios
        .filter((m) => m.provinciaId === nuestroProv)
        .map((m) => [normalizar(m.nombre), m.id]),
    );
    await mapAsync(munsOptic, async (mun) => {
      const munIdDataset = municipiosIdDataset.get(normalizar(mun.name));
      const distsOptic = aList(
        await get<Item | Item[]>(
          `/districts?municipalityCode=${mun.code}&provinceCode=${prov.code}&regionCode=${prov.regionCode}`,
        ),
      );

      // OGTIC incluye el municipio cabecera como "distrito"; lo excluimos para comparar DMs
      const distsDm = distsOptic.filter(
        (d) => normalizar(d.name) !== normalizar(mun.name),
      );
      const nombresDistOptic = new Set(distsDm.map((d) => normalizar(d.name)));

      const distsDataset = munIdDataset
        ? dataset.distritos
            .filter((d) => d.municipioId === munIdDataset)
            .map((d) => normalizar(d.nombre))
        : [];
      const solos = distsDataset.filter((n) => !nombresDistOptic.has(n));
      const extraOptic = distsDm
        .filter((d) => !new Set(distsDataset).has(normalizar(d.name)))
        .map((d) => d.name);

      if (solos.length || extraOptic.length) {
        diffs.distritos.push({
          municipio: mun.name,
          solosDataset: solos,
          solosOptic: extraOptic,
        });
      }
    });
  });

  // Reporte
  let diferencias = 0;
  const reportar = (titulo: string, lista: string[]) => {
    if (!lista.length) return;
    diferencias += 1;
    console.log(`\n⚠️  ${titulo}`);
    for (const x of lista) console.log(`   - ${x}`);
  };

  reportar('Provincias', diffs.provincias);
  for (const d of diffs.municipios) {
    console.log(
      `⚠️  Municipios de ${d.provincia}: solo-dataset [${d.solosDataset.join(', ') || '—'}] | solo-OGTIC [${d.solosOptic.join(', ') || '—'}]`,
    );
    diferencias += 1;
  }
  for (const d of diffs.distritos) {
    console.log(
      `⚠️  Distritos de ${d.municipio}: solo-dataset [${d.solosDataset.join(', ') || '—'}] | solo-OGTIC [${d.solosOptic.join(', ') || '—'}]`,
    );
    diferencias += 1;
  }

  if (diferencias === 0)
    console.log('\n✅ Sin diferencias en provincias, municipios ni distritos.');
  else
    console.log(
      `\n${diferencias} diferencias (esperadas: la API OGTIC usa la división territorial 2020; el dataset, 2023).`,
    );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
