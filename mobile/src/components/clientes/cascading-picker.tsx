import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppInput } from '@/components/ui/app-input';
import PickerField from '@/components/ui/picker-field';
import { PROVINCIAS, PROVINCIAS_MUNICIPIOS, getSectores as getSectoresLegacy } from '@/constants/ubicaciones';
import { useUbicaciones } from '@/hooks/use-ubicaciones';
import { getProvincias, getUnidades, getSectores } from '@/db/ubicaciones-db';
import { igualNormalizado } from '@/utils/texto';
import { PICKER_TIPO_BADGE } from '@/types/ubicaciones.types';

const OTRO_KEY = '__otro__';

const OTRO_OPCION = { label: 'Otro / escribir manualmente', value: OTRO_KEY, badge: 'Otro' };

export interface CascadingPickerProps {
  provincia: string | undefined;
  provinciaId: string | undefined;
  municipio: string | undefined;
  municipioId: string | undefined;
  sector: string | undefined;
  sectorId: string | undefined;
  onProvinciaChange: (id: string | undefined, nombre: string) => void;
  onMunicipioChange: (id: string | undefined, nombre: string) => void;
  onSectorChange: (id: string | undefined, nombre: string) => void;
  errors?: {
    provincia?: string;
    municipio?: string;
    sector?: string;
  };
  required?: boolean;
}

export default function CascadingPicker({
  provincia,
  provinciaId,
  municipio,
  municipioId,
  sector,
  sectorId,
  onProvinciaChange,
  onMunicipioChange,
  onSectorChange,
  errors,
  required = false,
}: CascadingPickerProps) {
  const { data: catalogo } = useUbicaciones();

  // El catálogo en react-query implica que la tabla SQLite ya fue sincronizada
  // por el hook (y en offline el hook devuelve el catálogo local). Los getters
  // leen la caché de SQLite, así que se invocan en cada render.
  const usarCatalogo = !!catalogo;
  const nombreProv = provincia ?? '';
  const nombreMuni = municipio ?? '';
  const nombreSector = sector ?? '';

  const provincias = getProvincias();

  const provinciaResuelta = useMemo(
    () =>
      provincias.find((p) => p.id === provinciaId) ||
      provincias.find((p) => igualNormalizado(p.nombre, nombreProv)) ||
      null,
    [provincias, provinciaId, nombreProv],
  );

  const unidades = useMemo(
    () =>
      usarCatalogo
        ? getUnidades(provinciaResuelta?.id ?? '')
        : (nombreProv ? PROVINCIAS_MUNICIPIOS[nombreProv] ?? [] : []).map((n) => ({
            id: n,
            nombre: n,
            tipo: 'MUNICIPIO' as const,
            municipioNombre: null,
          })),
    [usarCatalogo, provinciaResuelta, nombreProv],
  );

  const municipioResuelto = useMemo(
    () =>
      unidades.find((u) => u.id === municipioId) ||
      unidades.find((u) => u.tipo === 'MUNICIPIO' && igualNormalizado(u.nombre, nombreMuni)) ||
      unidades.find((u) => u.tipo === 'DISTRITO_MUNICIPAL' && igualNormalizado(u.nombre, nombreMuni)) ||
      null,
    [unidades, municipioId, nombreMuni],
  );

  const sectores = useMemo(
    () => (usarCatalogo ? getSectores(municipioResuelto?.id ?? '') : []),
    [usarCatalogo, municipioResuelto],
  );

  const sectorResuelto = useMemo(
    () =>
      sectores.find((s) => s.id === sectorId) ||
      sectores.find((s) => igualNormalizado(s.nombre, nombreSector)) ||
      null,
    [sectores, sectorId, nombreSector],
  );

  const opcionesProvincias = provincias.map((p) => ({ label: p.nombre, value: p.id }));

  const opcionesMunicipios = unidades.map((u) => ({
    label: u.nombre,
    value: u.id,
    ...(u.tipo === 'DISTRITO_MUNICIPAL' ? { badge: 'Distrito' } : {}),
  }));

  const opcionesSectores = usarCatalogo
    ? [
        ...sectores.map((s) => ({
          label: s.nombre,
          value: s.id,
          badge: PICKER_TIPO_BADGE[s.tipo],
        })),
        ...(sectores.length > 0 && nombreMuni ? [OTRO_OPCION] : []),
      ]
    : (() => {
        const legacy = nombreMuni ? getSectoresLegacy(nombreMuni) : [];
        return legacy.length ? [...legacy, OTRO_OPCION] : [];
      })();

  const tieneSectores = opcionesSectores.length > 0;

  // Modo "Otro / escribir manualmente": se activa explícitamente al elegir la
  // opción, o automáticamente al editar un cliente cuyo sector legacy no existe
  // en el catálogo (name-match fallback). Se resetea en los handlers de
  // provincia/municipio (sin efectos que cascaden setState).
  const [usarSectorLibre, setUsarSectorLibre] = useState(false);
  const mostrarSectorLibre =
    !tieneSectores || usarSectorLibre || (nombreSector !== '' && !sectorResuelto);

  const handleProvinciaSelect = useCallback(
    (value: string) => {
      setUsarSectorLibre(false);
      if (usarCatalogo) {
        const p = provincias.find((x) => x.id === value);
        onProvinciaChange(p?.id, p?.nombre ?? value);
      } else {
        onProvinciaChange(undefined, value);
      }
    },
    [usarCatalogo, provincias, onProvinciaChange],
  );

  const handleMunicipioSelect = useCallback(
    (value: string) => {
      setUsarSectorLibre(false);
      if (usarCatalogo) {
        const u = unidades.find((x) => x.id === value);
        onMunicipioChange(u?.id, u?.nombre ?? value);
      } else {
        onMunicipioChange(undefined, value);
      }
    },
    [usarCatalogo, unidades, onMunicipioChange],
  );

  const handleSectorSelect = useCallback(
    (value: string) => {
      if (value === OTRO_KEY) {
        setUsarSectorLibre(true);
        onSectorChange(undefined, '');
        return;
      }
      if (usarCatalogo) {
        const s = sectores.find((x) => x.id === value);
        onSectorChange(s?.id, s?.nombre ?? value);
      } else {
        onSectorChange(undefined, value);
      }
    },
    [usarCatalogo, sectores, onSectorChange],
  );

  const municipioValue = usarCatalogo && municipioResuelto ? municipioResuelto.id : municipio;
  const sectorPickerValue = usarCatalogo && sectorResuelto ? sectorResuelto.id : sector;

  const hintSectorLibre =
    !tieneSectores && usarCatalogo && municipioResuelto
      ? 'No hay sectores precargados para este municipio, escribe libremente'
      : undefined;

  return (
    <View style={styles.container}>
      <PickerField
        label="Provincia"
        placeholder="Selecciona una provincia"
        value={usarCatalogo ? provinciaResuelta?.id : provincia}
        options={usarCatalogo ? opcionesProvincias : PROVINCIAS}
        onSelect={handleProvinciaSelect}
        error={errors?.provincia}
        required={required}
        searchable
      />

      <PickerField
        label="Municipio"
        placeholder={provincia ? 'Selecciona un municipio' : 'Primero elige provincia'}
        value={municipioValue}
        options={opcionesMunicipios}
        onSelect={handleMunicipioSelect}
        editable={!!provincia && opcionesMunicipios.length > 0}
        error={errors?.municipio}
        required={required}
        searchable={opcionesMunicipios.length > 10}
      />

      {tieneSectores && !mostrarSectorLibre ? (
        <PickerField
          label="Sector / Barrio"
          placeholder={
            municipio ? 'Selecciona un sector' : 'Primero elige municipio'
          }
          value={sectorPickerValue}
          options={opcionesSectores}
          onSelect={handleSectorSelect}
          editable={!!municipio}
          error={errors?.sector}
          searchable
        />
      ) : (
        <AppInput
          label="Sector / Barrio"
          placeholder={
            !municipio
              ? 'Primero elige municipio'
              : 'Escribe el sector o barrio…'
          }
          value={sector || ''}
          onChangeText={(text) => onSectorChange(undefined, text)}
          editable={!!municipio}
          error={errors?.sector}
          hint={hintSectorLibre}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
});