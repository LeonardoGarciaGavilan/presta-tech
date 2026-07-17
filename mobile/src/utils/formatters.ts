export function formatCedula(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`;
}

export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '');
  if (d.length === 10 && ['809', '829', '849'].includes(d.slice(0, 3))) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return value.replace(/[^\d+]/g, '');
}

export function unformatPhone(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

export function unformatCedula(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'RD$ 0.00';
  return `RD$ ${new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function formatIngresosInput(value: string): string {
  const r = value.replace(/[^\d.]/g, '');
  const parts = r.split('.');
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
}

export function unformatIngresosInput(value: string): string {
  return value.replace(/,/g, '');
}

function parseLocalDate(value: string): Date {
  const datePart = value.split('T')[0];
  const parts = datePart.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function formatDateShort(value: string | null): string {
  if (!value) return '';
  const date = value.includes('T') ? new Date(value) : parseLocalDate(value);
  return date.toLocaleDateString('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDate(value: string | null): string {
  if (!value) return 'No disponible';
  const date = value.includes('T') ? new Date(value) : parseLocalDate(value);
  return date.toLocaleDateString('es-DO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(value: string | null): string {
  if (!value) return 'No disponible';
  const date = value.includes('T') ? new Date(value) : parseLocalDate(value);
  return date.toLocaleDateString('es-DO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrencyCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatFullCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'recién';
  if (diffMins < 60) return `hace ${diffMins}min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  return `hace ${Math.floor(diffHours / 24)}d`;
}

export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function dateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
