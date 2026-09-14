import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { HoldToConfirmButton } from './hold-to-confirm-button';
import { ThemeProvider } from './theme-provider';
import * as Haptics from 'expo-haptics';

const haptics = Haptics as unknown as {
  notificationAsync: jest.Mock;
  impactAsync: jest.Mock;
};

jest.mock('expo-haptics', () => ({
  __esModule: true,
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('HoldToConfirmButton', () => {
  beforeEach(() => {
    haptics.notificationAsync.mockClear();
    haptics.impactAsync.mockClear();
  });

  it('dispara onConfirm cuando se mantiene presionado el tiempo completo', async () => {
    const onConfirm = jest.fn();
    const { getByRole } = await renderWithTheme(
      <HoldToConfirmButton title="Desembolsar" onConfirm={onConfirm} durationMs={100} />,
    );

    fireEvent(getByRole('button'), 'pressIn');

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(haptics.notificationAsync).toHaveBeenCalled();
  });

  it('no dispara onConfirm si el usuario suelta antes de tiempo', async () => {
    const onConfirm = jest.fn();
    const { getByRole } = await renderWithTheme(
      <HoldToConfirmButton title="Desembolsar" onConfirm={onConfirm} durationMs={200} />,
    );

    fireEvent(getByRole('button'), 'pressIn');
    await sleep(80);
    fireEvent(getByRole('button'), 'pressOut');
    await sleep(300);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('respeta durationMs personalizado', async () => {
    const onConfirm = jest.fn();
    const { getByRole } = await renderWithTheme(
      <HoldToConfirmButton title="Saldar" onConfirm={onConfirm} durationMs={300} />,
    );

    fireEvent(getByRole('button'), 'pressIn');
    await sleep(150);
    expect(onConfirm).not.toHaveBeenCalled();

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('confirma a través de la acción de accesibilidad', async () => {
    const onConfirm = jest.fn();
    const { getByRole } = await renderWithTheme(
      <HoldToConfirmButton title="Desembolsar" onConfirm={onConfirm} durationMs={1000} />,
    );

    fireEvent(getByRole('button'), 'accessibilityAction', {
      nativeEvent: { actionName: 'confirm' },
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('no responde al estar disabled', async () => {
    const onConfirm = jest.fn();
    const { getByRole } = await renderWithTheme(
      <HoldToConfirmButton title="Desembolsar" onConfirm={onConfirm} disabled durationMs={100} />,
    );

    fireEvent(getByRole('button'), 'pressIn');
    await sleep(200);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancela el hold si el dedo sale del área del botón', async () => {
    const onConfirm = jest.fn();
    const { getByRole } = await renderWithTheme(
      <HoldToConfirmButton title="Desembolsar" onConfirm={onConfirm} durationMs={200} />,
    );

    fireEvent(getByRole('button'), 'pressIn');
    await sleep(80);
    // Al salir del área (pressRetentionOffset=0) Pressable dispara onPressOut.
    fireEvent(getByRole('button'), 'pressOut');
    await sleep(400);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('expone el estado busy cuando está cargando', async () => {
    const { getByRole } = await renderWithTheme(
      <HoldToConfirmButton title="Desembolsar" onConfirm={jest.fn()} loading />,
    );

    expect(getByRole('button').props.accessibilityState.busy).toBe(true);
  });
});