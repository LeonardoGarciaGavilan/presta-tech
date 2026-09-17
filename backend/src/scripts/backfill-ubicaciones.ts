import { Prisma, PrismaClient, Ubicacion } from '@prisma/client';

/*
 * Backfill de ubicaciones en Cliente.
 * Normaliza los strings legados (provincia/municipio/sector) contra el
 * catálogo y rellena sus ids (provinciaId/municipioId/sectorId) y el nombre
 * canónico SOLO cuando hay match único dentro del contexto jerárquico.
 * Los casos sin match o ambiguos se reportan y no se tocan.
 * Idempotente: completa únicamente los campos que están vacíos o en null.
 * Uso: npm run backfill:ubicaciones [-- --dry-run]   (dry-run no escribe)
 */

type TipoCampo = 'provincia' | 'municipio' | 'sector';

interface Pendiente {
  clienteId: string;
  valor: string;
  n: number;
  extra?: string;
}

interface Actualizacion {
  id: string;
  data: Prisma.ClienteUncheckedUpdateInput;
}

const prisma = new PrismaClient();
const CONCURRENCIA = 8;
const DRY_RUN = process.argv.includes('--dry-run');
const TOP_PENDIENTES = 20;

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

function reportarPendientes(titulo: string, pendientes: Pendiente[]): void {
  if (pendientes.length === 0) return;
  console.log(`  ⚠️ ${titulo}: ${pendientes.length}`);
  for (const p of pendientes.slice(0, TOP_PENDIENTES)) {
    const motivo = p.n === 0 ? 'sin match' : `ambiguo (${p.n} candidatos)`;
    console.log(
      `     · ${p.clienteId} · "${p.valor}" → ${motivo}${p.extra ? ` · ${p.extra}` : ''}`,
    );
  }
  if (pendientes.length > TOP_PENDIENTES) {
    console.log(`     … y ${pendientes.length - TOP_PENDIENTES} más`);
  }
}

async function main(): Promise<void> {
  const filas = await prisma.ubicacion.findMany();
  const agrupar = (filasNivel: Ubicacion[]): Map<string, Ubicacion[]> => {
    const m = new Map<string, Ubicacion[]>();
    for (const f of filasNivel) {
      const k = normalizar(f.nombre);
      const arr = m.get(k);
      if (arr) arr.push(f);
      else m.set(k, [f]);
    }
    return m;
  };

  const provinciasPorNombre = agrupar(
    filas.filter((f) => f.tipo === 'PROVINCIA'),
  );
  const unidadesPorNombre = agrupar(
    filas.filter(
      (f) => f.tipo === 'MUNICIPIO' || f.tipo === 'DISTRITO_MUNICIPAL',
    ),
  );
  const sectoresPorNombre = agrupar(
    filas.filter(
      (f) =>
        f.tipo === 'BARRIO' || f.tipo === 'SUB_BARRIO' || f.tipo === 'SECCION',
    ),
  );
  const byId = new Map(filas.map((f) => [f.id, f]));

  const conteo = (tipo: string) => filas.filter((f) => f.tipo === tipo).length;
  console.log(
    `🧭 Catálogo: ${conteo('PROVINCIA')} provincias · ${conteo('MUNICIPIO')} municipios · ` +
      `${conteo('DISTRITO_MUNICIPAL')} distritos · ${conteo('SECCION')} secciones · ` +
      `${conteo('BARRIO')} barrios · ${conteo('SUB_BARRIO')} sub-barrios`,
  );

  const clientes = await prisma.cliente.findMany({
    where: {
      AND: [
        {
          OR: [
            { provincia: { not: null } },
            { municipio: { not: null } },
            { sector: { not: null } },
          ],
        },
        {
          OR: [
            { provinciaId: null },
            { municipioId: null },
            { sectorId: null },
          ],
        },
      ],
    },
    select: {
      id: true,
      provincia: true,
      municipio: true,
      sector: true,
      provinciaId: true,
      municipioId: true,
      sectorId: true,
    },
  });
  console.log(`🧭 Clientes a analizar: ${clientes.length}`);

  const pendientes: Record<TipoCampo, Pendiente[]> = {
    provincia: [],
    municipio: [],
    sector: [],
  };
  const updates: Actualizacion[] = [];
  const yaListos = new Set<string>();

  for (const c of clientes) {
    const data: Prisma.ClienteUncheckedUpdateInput = {};
    let provId = c.provinciaId;
    let munId = c.municipioId;
    let secId = c.sectorId;

    const provinciaStr = c.provincia?.trim() || '';
    const municipioStr = c.municipio?.trim() || '';
    const sectorStr = c.sector?.trim() || '';

    if (!provId && provinciaStr) {
      const cands = provinciasPorNombre.get(normalizar(provinciaStr)) ?? [];
      if (cands.length === 1) {
        provId = cands[0].id;
        data.provinciaId = provId;
        data.provincia = cands[0].nombre;
      } else {
        pendientes.provincia.push({
          clienteId: c.id,
          valor: provinciaStr,
          n: cands.length,
        });
      }
    } else if (provId && !provinciaStr) {
      const node = byId.get(provId);
      if (node) data.provincia = node.nombre;
    }

    if (!munId && municipioStr) {
      const glob = unidadesPorNombre.get(normalizar(municipioStr)) ?? [];
      const cands = provId
        ? glob.filter((u) => u.provinciaId === provId)
        : glob;
      if (cands.length === 1) {
        munId = cands[0].id;
        data.municipioId = munId;
        data.municipio = cands[0].nombre;
        if (!provId && !provinciaStr && cands[0].provinciaId) {
          provId = cands[0].provinciaId;
          data.provinciaId = provId;
          data.provincia = byId.get(provId)?.nombre ?? cands[0].provinciaId;
        }
      } else {
        const fueraDeProvincia =
          provId &&
          cands.length === 0 &&
          glob.length === 1 &&
          glob[0].provinciaId !== provId
            ? `fuera de la provincia (${glob.length} global)`
            : undefined;
        pendientes.municipio.push({
          clienteId: c.id,
          valor: municipioStr,
          n: cands.length,
          extra: fueraDeProvincia,
        });
      }
    } else if (munId && !municipioStr) {
      const node = byId.get(munId);
      if (node) data.municipio = node.nombre;
    }

    if (!secId && sectorStr) {
      let cands = sectoresPorNombre.get(normalizar(sectorStr)) ?? [];
      if (munId) {
        cands = cands.filter(
          (s) => s.unidadPadreId === munId || s.municipioId === munId,
        );
      } else if (provId) {
        cands = cands.filter((s) => s.provinciaId === provId);
      }
      if (cands.length === 1) {
        secId = cands[0].id;
        data.sectorId = secId;
        data.sector = cands[0].nombre;
      } else {
        pendientes.sector.push({
          clienteId: c.id,
          valor: sectorStr,
          n: cands.length,
        });
      }
    } else if (secId && !sectorStr) {
      const node = byId.get(secId);
      if (node) data.sector = node.nombre;
    }

    const campos = Object.keys(data);
    if (campos.length === 0) {
      yaListos.add(c.id);
    } else {
      updates.push({ id: c.id, data });
    }
  }

  let escritos = 0;
  if (!DRY_RUN && updates.length > 0) {
    escritos = await runConConcurrencia(updates, CONCURRENCIA, (u) =>
      prisma.cliente.update({ where: { id: u.id }, data: u.data }),
    );
  }

  const camposTotales = updates.reduce(
    (a, u) => a + Object.keys(u.data).length,
    0,
  );
  const modo = DRY_RUN ? 'DRY-RUN (sin escrituras)' : 'escritura';
  console.log(
    `\n✔ ${updates.length} clientes a actualizar · ${camposTotales} campos · modo ${modo}`,
  );
  console.log(`✓ ${yaListos.size} clientes ya consistentes (sin cambios)`);

  reportarPendientes('Pendientes [provincia]', pendientes.provincia);
  reportarPendientes('Pendientes [municipio]', pendientes.municipio);
  reportarPendientes('Pendientes [sector]', pendientes.sector);

  const totalPendientes =
    pendientes.provincia.length +
    pendientes.municipio.length +
    pendientes.sector.length;
  console.log(
    DRY_RUN
      ? `✅ Backfill simulado (0 escrituras efectivas, ${escritos} en cola)`
      : `✅ Backfill completado: ${escritos} actualizados · ${totalPendientes} pendientes sin tocar`,
  );
}

main()
  .catch((err) => {
    console.error('❌ Error en backfill-ubicaciones:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
