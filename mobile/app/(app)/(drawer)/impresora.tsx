import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Device, ScanResult } from 'react-native-thermal-printer-driver';

import { AppButton } from '@/components/ui/app-button';
import { useTheme } from '@/components/ui/theme-provider';
import { BorderRadius, FontSize, FontWeight, scale, Spacing, Shadows } from '@/constants/theme';
import {
  desconectarImpresora,
  direccionConTransporte,
  direccionLegible,
  escanearImpresoras,
  imprimirPrueba,
  isThermalPrinterDisponible,
  mensajeErrorImpresora,
  requestBluetoothPermission,
} from '@/services/printer.service';
import { usePrinterStore } from '@/store/printer.store';
import { renderNodes, buildReciboDocument } from '@/utils/recibo-escpos';
import type { ReciboData } from '@/utils/recibo-pdf';
import { buildDocumentoPrueba } from '@/utils/recibo-test';
import { fusionarListas } from '@/utils/dispositivos';

const DEVICE_TYPE_LABEL: Record<Device['deviceType'], string> = {
  bt: 'Bluetooth',
  ble: 'BLE',
  dual: 'BT + BLE',
  unknown: 'Desconocido',
};

const DEMO_RECIBO: ReciboData = {
  pago: {
    id: 'pago_0000000012345678',
    capital: 1000,
    interes: 150,
    mora: 20,
    abonoCapital: 0,
    montoTotal: 1170,
    metodo: 'EFECTIVO',
    referencia: null,
    observacion: 'Ejemplo de vista previa',
    pagoCompleto: true,
    createdAt: new Date().toISOString(),
  },
  cliente: { nombre: 'JUAN', apellido: 'PÉREZ', cedula: '001-1234567-8' },
  prestamo: { monto: 25000, numeroCuotas: 8, frecuenciaPago: 'SEMANAL', saldoPendiente: 23830 },
  cuota: {
    id: 'cuota_demo',
    numero: 1,
    monto: 1170,
    capital: 1000,
    interes: 150,
    mora: 20,
    fechaVencimiento: new Date().toISOString(),
    pagoCompleto: true,
  },
  usuario: { nombre: 'Sistema' },
};

export default function ImpresoraScreen() {
  const { colors } = useTheme();
  const printerConfig = usePrinterStore((state) => state.printer);
  const setPrinter = usePrinterStore((state) => state.setPrinter);
  const clearPrinter = usePrinterStore((state) => state.clearPrinter);

  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<ScanResult | null>(null);
  const [busyAddress, setBusyAddress] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [showTestPreview, setShowTestPreview] = useState(false);

  const { vinculadas, detectadas } = devices
    ? fusionarListas(devices)
    : { vinculadas: [], detectadas: [] };

  useEffect(() => {
    usePrinterStore.getState().hydrate();
    let active = true;
    isThermalPrinterDisponible().then((available) => {
      if (active) setDisponible(available);
    });
    return () => {
      active = false;
    };
  }, []);

  const pushLog = (line: string) => {
    const stamp = new Date().toLocaleTimeString('es-PE', { hour12: false });
    setLog((prev) => [...prev.slice(-49), `[${stamp}] ${line}`]);
  };

  const handleBuscar = async () => {
    if (disponible !== true) return;
    setScanning(true);
    pushLog('Solicitando permisos Bluetooth...');
    try {
      const granted = await requestBluetoothPermission();
      if (!granted) {
        pushLog('Permisos Bluetooth denegados');
        Alert.alert('Permisos', 'Se necesita el permiso de Bluetooth para buscar impresoras.');
        return;
      }
      pushLog('Buscando impresoras Bluetooth...');
      const result = await escanearImpresoras();
      setDevices(result);
      pushLog(`Escaneo completado: ${result.paired.length} vinculadas, ${result.found.length} encontradas`);
    } catch (error) {
      pushLog(`Error al escanear: ${mensajeErrorImpresora(error)}`);
      Alert.alert('Error de escaneo', mensajeErrorImpresora(error));
    } finally {
      setScanning(false);
    }
  };

  const handleUsarDispositivo = async (device: Device) => {
    setBusyAddress(device.address);
    const address = direccionConTransporte(device.address, device.deviceType);
    pushLog(`Configurando ${device.name} (${device.address}) como impresora por defecto...`);
    try {
      await setPrinter({ address, name: device.name });
      pushLog('Guardada como impresora por defecto');
    } catch (error) {
      pushLog(`No se pudo guardar la configuración: ${mensajeErrorImpresora(error)}`);
    }
    pushLog(`Enviando prueba a ${device.name}...`);
    try {
      const result = await imprimirPrueba(address);
      if (result.success) {
        pushLog(`Impresión enviada (${result.bytesWritten ?? 0} bytes)`);
        Alert.alert('Listo', `${device.name} configurada y prueba enviada.`);
      } else {
        const error = result.error;
        const msg = error
          ? `${error.message} [${error.code}]`
          : 'La impresora no respondió correctamente.';
        pushLog(`Fallo al imprimir: ${msg}`);
        Alert.alert('Fallo de impresión', msg);
      }
    } catch (error) {
      pushLog(`Fallo al imprimir: ${mensajeErrorImpresora(error)}`);
      Alert.alert('Fallo de impresión', mensajeErrorImpresora(error));
    } finally {
      setBusyAddress(null);
      desconectarImpresora(address).catch(() => undefined);
    }
  };

  const handleDesvincular = async () => {
    await clearPrinter();
    pushLog('Impresora por defecto desvinculada');
    Alert.alert('Listo', 'Impresora por defecto desvinculada.');
  };

  const renderDevice = (device: Device, section: string) => {
    const esActual = printerConfig?.address === direccionConTransporte(device.address, device.deviceType);
    const ocupado = busyAddress === device.address;
    return (
      <TouchableOpacity
        key={`${section}-${device.address}`}
        style={[
          styles.deviceRow,
          { backgroundColor: colors.card, borderColor: esActual ? colors.success : colors.border },
          Shadows.sm,
        ]}
        onPress={() => handleUsarDispositivo(device)}
        disabled={busyAddress !== null}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Configurar y probar impresora ${device.name}`}
      >
        <View
          style={[
            styles.deviceIcon,
            { backgroundColor: ocupado ? colors.primaryLight : colors.surface },
          ]}
        >
          <Ionicons
            name={ocupado ? 'hourglass-outline' : 'print-outline'}
            size={scale(20)}
            color={ocupado ? colors.primary : colors.textSecondary}
          />
        </View>
        <View style={styles.deviceInfo}>
          <Text style={[styles.deviceName, { color: colors.text }]} numberOfLines={1}>
            {device.name || '(sin nombre)'}
          </Text>
          <Text style={[styles.deviceMeta, { color: colors.textTertiary }]}>
            {device.address} · {DEVICE_TYPE_LABEL[device.deviceType]}
            {typeof device.rssi === 'number' ? ` · ${device.rssi}dBm` : ''}
          </Text>
        </View>
        <Text
          style={[
            styles.deviceAction,
            { color: ocupado ? colors.primary : esActual ? colors.success : colors.primary },
          ]}
        >
          {ocupado ? 'Probando...' : esActual ? 'En uso' : 'Usar'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="information-circle-outline" size={scale(18)} color={colors.textSecondary} />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Configura tu impresora térmica 58mm (Jaclink, 2Connect u otras). Las impresoras ya
          vinculadas al teléfono aparecen en «Conectadas al teléfono»; las demás, en «Detectadas en el
          escaneo». Púlsala para usarla como impresora por defecto y enviar una prueba. Los recibos de
          pagos y caja se imprimirán en ella automáticamente.
        </Text>
      </View>

      {disponible === true && Platform.OS === 'ios' && (
        <View style={[styles.warnCard, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
          <Ionicons name="alert-circle-outline" size={scale(18)} color={colors.warning} />
          <Text style={[styles.warnText, { color: colors.textSecondary }]}>
            En iOS el Bluetooth clásico (SPP) no está disponible para apps de terceros, por lo que no se
            puede conectar con las impresoras 58mm. La impresión en iPhone irá por AirPrint en una fase
            posterior.
          </Text>
        </View>
      )}

      {disponible === false && (
        <View style={[styles.warnCard, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
          <Ionicons name="warning-outline" size={scale(18)} color={colors.warning} />
          <Text style={[styles.warnText, { color: colors.textSecondary }]}>
            Estás en Expo Go: el módulo nativo de impresión térmica no está incluido aquí. Para probar la
            impresión real compila con `npx expo run:android` o crea un dev build con EAS. Abajo ves una
            vista previa de lo que imprime.
          </Text>
        </View>
      )}

      {printerConfig && (
        <View style={[styles.defaultCard, { backgroundColor: colors.card, borderColor: colors.success }]}>
          <View style={[styles.deviceIcon, { backgroundColor: colors.successLight }]}>
            <Ionicons name="checkmark-circle" size={scale(20)} color={colors.success} />
          </View>
          <View style={styles.deviceInfo}>
            <Text style={[styles.defaultLabel, { color: colors.textTertiary }]}>
              Impresora por defecto
            </Text>
            <Text style={[styles.deviceName, { color: colors.text }]} numberOfLines={1}>
              {printerConfig.name}
            </Text>
            <Text style={[styles.deviceMeta, { color: colors.textTertiary }]}>
              {direccionLegible(printerConfig.address)}
            </Text>
          </View>
          <TouchableOpacity onPress={handleDesvincular} hitSlop={8} accessibilityRole="button">
            <Ionicons name="link-outline" size={scale(20)} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}

      <AppButton
        title="Buscar impresoras"
        icon="bluetooth-outline"
        onPress={handleBuscar}
        loading={scanning}
        disabled={disponible !== true}
        style={{ marginBottom: Spacing.lg }}
        accessibilityLabel="Buscar impresoras Bluetooth"
      />

      {devices && (
        <>
          {vinculadas.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                CONECTADAS AL TELÉFONO ({vinculadas.length})
              </Text>
              {vinculadas.map((device) => renderDevice(device, 'vinculadas'))}
            </View>
          )}
          {detectadas.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                DETECTADAS EN EL ESCANEO ({detectadas.length})
              </Text>
              {detectadas.map((device) => renderDevice(device, 'detectadas'))}
            </View>
          )}
          {vinculadas.length === 0 && detectadas.length === 0 && (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No se detectaron impresoras. Si tu impresora ya está vinculada al teléfono debería
                aparecer en «Conectadas al teléfono»; también puedes vincularla en los ajustes de
                Bluetooth y volver a buscar.
              </Text>
            </View>
          )}
        </>
      )}

      {disponible === false && (
        <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.previewTitle, { color: colors.text }]}>
            Vista previa del recibo real (58mm / 32 columnas)
          </Text>
          <View style={[styles.previewArea, { backgroundColor: colors.surface }]}>
            {renderNodes(buildReciboDocument(DEMO_RECIBO)).map((line, index) => (
              <Text key={index} style={[styles.previewLine, { color: colors.textSecondary }]}>
                {line === '' ? '\u00A0' : line}
              </Text>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity onPress={() => setShowTestPreview((prev) => !prev)} style={styles.previewToggle} accessibilityRole="button">
        <Ionicons name={showTestPreview ? 'eye-outline' : 'eye-off-outline'} size={scale(14)} color={colors.textTertiary} />
        <Text style={[styles.previewToggleText, { color: colors.textTertiary }]}>
          {showTestPreview ? 'Ocultar' : 'Mostrar'} vista previa de prueba
        </Text>
      </TouchableOpacity>

      {showTestPreview && (
        <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.previewTitle, { color: colors.text }]}>
            Vista previa de prueba (58mm / 32 columnas)
          </Text>
          <View style={[styles.previewArea, { backgroundColor: colors.surface }]}>
            {renderNodes(buildDocumentoPrueba()).map((line, index) => (
              <Text key={index} style={[styles.previewLine, { color: colors.textSecondary }]}>
                {line === '' ? '\u00A0' : line}
              </Text>
            ))}
          </View>
        </View>
      )}

      {log.length > 0 && (
        <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.logTitle, { color: colors.text }]}>Bitácora</Text>
          {log.map((line, index) => (
            <Text key={index} style={[styles.logLine, { color: colors.textTertiary }]}>
              {line}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSize.xs, lineHeight: scale(17) },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  warnText: { flex: 1, fontSize: FontSize.xs, lineHeight: scale(17) },
  defaultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  defaultLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  previewTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: Spacing.sm },
  previewArea: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 0,
  },
  previewLine: {
    fontSize: FontSize.xs,
    lineHeight: scale(16),
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  previewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  previewToggleText: { fontSize: FontSize.xs },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  section: { marginBottom: Spacing.lg },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  deviceIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceInfo: { flex: 1, gap: 2 },
  deviceName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  deviceMeta: { fontSize: FontSize.xs },
  deviceAction: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  emptyCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  logCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  logTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: Spacing.xs },
  logLine: { fontSize: FontSize.xs, lineHeight: scale(16) },
});