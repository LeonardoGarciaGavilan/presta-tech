import { getToastDuration } from './toast';

describe('getToastDuration', () => {
  it('usa 8s para errores', () => {
    expect(getToastDuration('error')).toBe(8000);
  });

  it('usa 3s para éxito e info', () => {
    expect(getToastDuration('success')).toBe(3000);
    expect(getToastDuration('info')).toBe(3000);
  });

  it('respeta un override explícito', () => {
    expect(getToastDuration('success', 5000)).toBe(5000);
    expect(getToastDuration('error', 2000)).toBe(2000);
  });
});