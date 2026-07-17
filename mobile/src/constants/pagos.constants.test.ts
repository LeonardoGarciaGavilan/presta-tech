import {
  METODO_PAGO_LABELS,
  METODO_PAGO_OPTIONS,
  METODO_PAGO_ICONS,
} from './pagos.constants';

const PAYMENT_METHODS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CHEQUE'];

describe('METODO_PAGO_LABELS', () => {
  it('should have a label for every payment method', () => {
    for (const method of PAYMENT_METHODS) {
      expect(METODO_PAGO_LABELS[method]).toBeDefined();
      expect(typeof METODO_PAGO_LABELS[method]).toBe('string');
      expect(METODO_PAGO_LABELS[method].length).toBeGreaterThan(0);
    }
  });

  it('should only contain expected payment methods', () => {
    expect(Object.keys(METODO_PAGO_LABELS)).toEqual(PAYMENT_METHODS);
  });
});

describe('METODO_PAGO_OPTIONS', () => {
  it('should have the same length as METODO_PAGO_LABELS', () => {
    expect(METODO_PAGO_OPTIONS).toHaveLength(PAYMENT_METHODS.length);
  });

  it('each option should have a value and label', () => {
    for (const option of METODO_PAGO_OPTIONS) {
      expect(option).toHaveProperty('value');
      expect(option).toHaveProperty('label');
      expect(typeof option.value).toBe('string');
      expect(typeof option.label).toBe('string');
    }
  });

  it('values should match METODO_PAGO_LABELS keys', () => {
    const optionValues = METODO_PAGO_OPTIONS.map((o) => o.value);
    expect(optionValues).toEqual(PAYMENT_METHODS);
  });

  it('labels should match METODO_PAGO_LABELS values', () => {
    for (const option of METODO_PAGO_OPTIONS) {
      expect(option.label).toBe(METODO_PAGO_LABELS[option.value]);
    }
  });
});

describe('METODO_PAGO_ICONS', () => {
  it('should have an icon for every payment method', () => {
    for (const method of PAYMENT_METHODS) {
      expect(METODO_PAGO_ICONS[method]).toBeDefined();
      expect(typeof METODO_PAGO_ICONS[method]).toBe('string');
      expect(METODO_PAGO_ICONS[method].length).toBeGreaterThan(0);
    }
  });

  it('should only contain expected payment methods', () => {
    expect(Object.keys(METODO_PAGO_ICONS)).toEqual(PAYMENT_METHODS);
  });

  it('should have valid Ionicons icon names', () => {
    const validIconNames = [
      'cash-outline',
      'swap-horizontal-outline',
      'card-outline',
      'document-text-outline',
    ];
    for (const icon of Object.values(METODO_PAGO_ICONS)) {
      expect(validIconNames).toContain(icon);
    }
  });
});
