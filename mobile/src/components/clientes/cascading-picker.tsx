import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppInput } from '@/components/ui/app-input';
import PickerField from '@/components/ui/picker-field';
import { Spacing } from '@/constants/theme';
import { PROVINCIAS, PROVINCIAS_MUNICIPIOS, getSectores } from '@/constants/ubicaciones';
import { useTheme } from '@/components/ui/theme-provider';

const OTRO_KEY = '__otro__';

interface CascadingPickerProps {
  provincia: string | undefined;
  municipio: string | undefined;
  sector: string | undefined;
  onProvinciaChange: (value: string) => void;
  onMunicipioChange: (value: string) => void;
  onSectorChange: (value: string) => void;
  errors?: {
    provincia?: string;
    municipio?: string;
    sector?: string;
  };
}

export default function CascadingPicker({
  provincia,
  municipio,
  sector,
  onProvinciaChange,
  onMunicipioChange,
  onSectorChange,
  errors,
}: CascadingPickerProps) {
  const { colorScheme, colors } = useTheme();

  const municipios = useMemo(
    () => (provincia ? PROVINCIAS_MUNICIPIOS[provincia] ?? [] : []),
    [provincia],
  );

  const sectores = useMemo(
    () => (municipio ? getSectores(municipio) : []),
    [municipio],
  );

  const tieneSectores = sectores.length > 0;

  const [usarSectorLibre, setUsarSectorLibre] = useState(false);

  useEffect(() => {
    setUsarSectorLibre(false);
  }, [municipio]);

  useEffect(() => {
    if (tieneSectores && sector && !sectores.includes(sector)) {
      setUsarSectorLibre(true);
    }
  }, [tieneSectores, sector, sectores]);

  const opcionesSector = useMemo(() => {
    if (!tieneSectores) return [];
    return [...sectores, OTRO_KEY];
  }, [sectores, tieneSectores]);

  const handleSectorSelect = useCallback(
    (value: string) => {
      if (value === OTRO_KEY) {
        setUsarSectorLibre(true);
        onSectorChange('');
      } else {
        onSectorChange(value);
      }
    },
    [onSectorChange],
  );

  const sectorLabel = opcionesSector.find((o) => o === sector) ? sector : undefined;

  return (
    <View style={styles.container}>
      <PickerField
        label="Provincia"
        placeholder="Selecciona una provincia"
        value={provincia}
        options={PROVINCIAS}
        onSelect={onProvinciaChange}
        error={errors?.provincia}
        searchable
      />

      <PickerField
        label="Municipio"
        placeholder={provincia ? 'Selecciona un municipio' : 'Primero elige provincia'}
        value={municipio}
        options={municipios}
        onSelect={onMunicipioChange}
        editable={!!provincia && municipios.length > 0}
        error={errors?.municipio}
        searchable={municipios.length > 10}
      />

      {tieneSectores && !usarSectorLibre ? (
        <PickerField
          label="Sector / Barrio"
          placeholder={
            municipio ? 'Selecciona un sector' : 'Primero elige municipio'
          }
          value={sectorLabel}
          options={opcionesSector}
          onSelect={handleSectorSelect}
          editable={!!municipio}
          error={errors?.sector}
          searchable={sectores.length > 10}
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
          onChangeText={onSectorChange}
          editable={!!municipio}
          error={errors?.sector}
          hint={
            !tieneSectores
              ? 'No hay sectores precargados para este municipio, escribe libremente'
              : undefined
          }
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
