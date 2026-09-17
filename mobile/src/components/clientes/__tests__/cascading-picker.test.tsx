import { render, fireEvent, screen } from '@testing-library/react-native';
import { Text, View, Pressable, TextInput } from 'react-native';
import CascadingPicker from '../cascading-picker';
import type { CascadingPickerProps } from '../cascading-picker';

jest.mock('@/hooks/use-ubicaciones', () => ({
  useUbicaciones: jest.fn(),
}));

jest.mock('@/db/ubicaciones-db', () => ({
  getProvincias: jest.fn(),
  getUnidades: jest.fn(),
  getSectores: jest.fn(),
}));

jest.mock('@/constants/ubicaciones', () => ({
  PROVINCIAS: ['Azua', 'Distrito Nacional'],
  PROVINCIAS_MUNICIPIOS: { Azua: ['Azua', 'Estebanía'] },
  getSectores: jest.fn(),
}));

jest.mock('@/components/ui/picker-field', () => {
  const { Text, View, Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, testID, options, onSelect }: { label: string; testID?: string; options?: unknown[]; onSelect?: (v: string) => void }) => (
      <View testID={`${testID ?? label}__picker`}>
        <Text>{label}</Text>
        {(options ?? []).map((o) => {
          const value = ((o as { value?: string }).value ?? o) as string;
          return (
            <Pressable key={value} testID={`${testID ?? label}:${value}`} onPress={() => onSelect?.(value)}>
              <Text>{value}</Text>
            </Pressable>
          );
        })}
      </View>
    ),
  };
});

jest.mock('@/components/ui/app-input', () => {
  const { TextInput } = require('react-native');
  return {
    __esModule: true,
    AppInput: ({ label, testID, onChangeText }: { label: string; testID?: string; onChangeText?: (t: string) => void }) => (
      <TextInput testID={testID ?? label} onChangeText={onChangeText} />
    ),
  };
});

const { useUbicaciones } = require('@/hooks/use-ubicaciones');
const { getProvincias, getUnidades, getSectores } = require('@/db/ubicaciones-db');
const { getSectores: getSectoresLegacy } = require('@/constants/ubicaciones');

const provincias = [{ id: 'PROVINCIA:1', nombre: 'Azua', tipo: 'PROVINCIA' }];
const municipios = [
  { id: 'MUNICIPIO:2', nombre: 'Azua', tipo: 'MUNICIPIO', municipioNombre: null },
  { id: 'DISTRITO_MUNICIPAL:5', nombre: 'Barro Arriba', tipo: 'DISTRITO_MUNICIPAL', municipioNombre: 'Azua' },
];
const sectores = [
  { id: 'BARRIO:100', nombre: 'El Naranjo', tipo: 'BARRIO' },
  { id: 'SUBBARRIO:200', nombre: 'La Granja', tipo: 'SUB_BARRIO' },
];

const catalogo = {
  version: 'v1',
  generadoEn: '',
  provincias,
  municipios,
  distritos: [],
  secciones: [],
  barrios: [],
  subBarrios: [],
};

const baseProps: CascadingPickerProps = {
  provincia: undefined,
  provinciaId: undefined,
  municipio: undefined,
  municipioId: undefined,
  sector: undefined,
  sectorId: undefined,
  onProvinciaChange: jest.fn(),
  onMunicipioChange: jest.fn(),
  onSectorChange: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getProvincias as jest.Mock).mockReturnValue(provincias);
  (getUnidades as jest.Mock).mockReturnValue(municipios);
  (getSectores as jest.Mock).mockReturnValue(sectores);
  (getSectoresLegacy as jest.Mock).mockReturnValue(['El Naranjo', 'La Granja', 'Zona 1']);
});

describe('CascadingPicker (Fase 2)', () => {
  it('usa PROVINCIAS estáticas mientras el catálogo no está disponible', async () => {
    (useUbicaciones as jest.Mock).mockReturnValue({ data: undefined });
    const { getByTestId, queryByTestId } = await render(<CascadingPicker {...baseProps} />);

    await fireEvent.press(getByTestId('Provincia:Azua'));
    expect(baseProps.onProvinciaChange).toHaveBeenCalledWith(undefined, 'Azua');
    expect(queryByTestId('Sector / Barrio:__otro__')).toBeNull();
  });

  it('resuelve ids con el catálogo y pasa el id del nodo al seleccionar provincia/municipio/sector', async () => {
    (useUbicaciones as jest.Mock).mockReturnValue({ data: catalogo });
    const ui = (extra: Record<string, unknown>) => (
      <CascadingPicker {...baseProps} {...extra} />
    );
    const { rerender } = await render(ui({}));

    await fireEvent.press(screen.getByTestId('Provincia:PROVINCIA:1'));
    expect(baseProps.onProvinciaChange).toHaveBeenCalledWith('PROVINCIA:1', 'Azua');

    await rerender(ui({ provincia: 'Azua', provinciaId: 'PROVINCIA:1' }));
    await fireEvent.press(screen.getByTestId('Municipio:MUNICIPIO:2'));
    expect(baseProps.onMunicipioChange).toHaveBeenCalledWith('MUNICIPIO:2', 'Azua');
    expect(getUnidades).toHaveBeenCalledWith('PROVINCIA:1');

    await rerender(ui({
      provincia: 'Azua',
      provinciaId: 'PROVINCIA:1',
      municipio: 'Azua',
      municipioId: 'MUNICIPIO:2',
    }));
    await fireEvent.press(screen.getByTestId('Sector / Barrio:BARRIO:100'));
    expect(baseProps.onSectorChange).toHaveBeenCalledWith('BARRIO:100', 'El Naranjo');
    expect(getSectores).toHaveBeenCalledWith('MUNICIPIO:2');
  });

  it('marca Otro al elegir la opción de escritura manual y muestra el input libre', async () => {
    (useUbicaciones as jest.Mock).mockReturnValue({ data: catalogo });
    const props = {
      ...baseProps,
      provincia: 'Azua',
      provinciaId: 'PROVINCIA:1',
      municipio: 'Azua',
      municipioId: 'MUNICIPIO:2',
    };
    const { rerender } = await render(<CascadingPicker {...props} />);

    await fireEvent.press(screen.getAllByTestId('Sector / Barrio:__otro__')[0]);
    expect(baseProps.onSectorChange).toHaveBeenCalledWith(undefined, '');

    await rerender(<CascadingPicker {...props} />);
    expect(screen.queryAllByTestId('Sector / Barrio:__otro__')).toHaveLength(0);
    expect(screen.getByTestId('Sector / Barrio').type).toBe('TextInput');
  });

  it('usa el fallback legacy de sectores cuando el catálogo no está disponible', async () => {
    (useUbicaciones as jest.Mock).mockReturnValue({ data: undefined });
    const props = { ...baseProps, provincia: 'Azua', municipio: 'Azua' };
    await render(<CascadingPicker {...props} />);

    expect(getSectoresLegacy).toHaveBeenCalledWith('Azua');
    await fireEvent.press(screen.getByTestId('Sector / Barrio:Zona 1'));
    expect(baseProps.onSectorChange).toHaveBeenCalledWith(undefined, 'Zona 1');
  });
});