import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';

export type CategoriaModulo = 'quick' | 'admin' | 'finanzas';

export interface ModuloItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  categoria: CategoriaModulo;
  modulo?: string;
  permiso?: string;
  colorKey: keyof typeof Colors.light;
  bgKey: keyof typeof Colors.light;
}

export const MODULOS: ModuloItem[] = [
  {
    id: 'sync',
    label: 'Sincronizar',
    sublabel: 'Actualizar datos',
    icon: 'sync-outline',
    route: '/sincronizacion',
    categoria: 'quick',
    modulo: 'SYNC',
    colorKey: 'primary',
    bgKey: 'primaryLight',
  },
  {
    id: 'rutas',
    label: 'Rutas',
    sublabel: 'Cobros por ruta',
    icon: 'map-outline',
    route: '/rutas',
    categoria: 'quick',
    modulo: 'RUTAS',
    permiso: 'rutas:ver',
    colorKey: 'route',
    bgKey: 'routeBg',
  },
  {
    id: 'impresora',
    label: 'Impresora',
    sublabel: 'Configurar térmica',
    icon: 'print-outline',
    route: '/impresora',
    categoria: 'quick',
    colorKey: 'warning',
    bgKey: 'warningLight',
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    sublabel: 'Preferencias',
    icon: 'settings-outline',
    route: '/configuracion',
    categoria: 'quick',
    modulo: 'CONFIGURACION',
    permiso: 'configuracion:editar',
    colorKey: 'info',
    bgKey: 'infoLight',
  },
  {
    id: 'alertas',
    label: 'Alertas',
    sublabel: 'Notificaciones',
    icon: 'notifications-outline',
    route: '/admin/alertas',
    categoria: 'admin',
    modulo: 'ALERTAS',
    permiso: 'alertas:ver',
    colorKey: 'error',
    bgKey: 'errorLight',
  },
  {
    id: 'analisis-rutas',
    label: 'Análisis de rutas',
    sublabel: 'Rendimiento',
    icon: 'analytics-outline',
    route: '/admin/analisis-rutas',
    categoria: 'admin',
    modulo: 'RUTAS',
    permiso: 'finanzas:ver',
    colorKey: 'primary',
    bgKey: 'primaryLight',
  },
  {
    id: 'empleados',
    label: 'Empleados',
    sublabel: 'Equipo de trabajo',
    icon: 'people-outline',
    route: '/admin/empleados',
    categoria: 'admin',
    modulo: 'EMPLEADOS',
    permiso: 'empleados:ver',
    colorKey: 'route',
    bgKey: 'routeBg',
  },
  {
    id: 'usuarios',
    label: 'Usuarios',
    sublabel: 'Accesos y roles',
    icon: 'person-circle-outline',
    route: '/admin/usuarios',
    categoria: 'admin',
    modulo: 'USUARIOS',
    permiso: 'usuarios:ver',
    colorKey: 'info',
    bgKey: 'infoLight',
  },
  {
    id: 'auditoria',
    label: 'Auditoría',
    sublabel: 'Historial de cambios',
    icon: 'document-text-outline',
    route: '/admin/auditoria',
    categoria: 'admin',
    modulo: 'AUDITORIA',
    permiso: 'auditoria:ver',
    colorKey: 'warning',
    bgKey: 'warningLight',
  },
  {
    id: 'estado-financiero',
    label: 'Estado financiero',
    sublabel: 'Resumen de finanzas',
    icon: 'wallet-outline',
    route: '/admin/estado-financiero',
    categoria: 'finanzas',
    modulo: 'FINANZAS',
    permiso: 'finanzas:ver',
    colorKey: 'success',
    bgKey: 'successLight',
  },
  {
    id: 'gastos',
    label: 'Gastos',
    sublabel: 'Registro de gastos',
    icon: 'cart-outline',
    route: '/admin/gastos',
    categoria: 'finanzas',
    modulo: 'GASTOS',
    permiso: 'gastos:ver',
    colorKey: 'error',
    bgKey: 'errorLight',
  },
  {
    id: 'reportes',
    label: 'Reportes',
    sublabel: 'Exportar información',
    icon: 'bar-chart-outline',
    route: '/admin/reportes',
    categoria: 'finanzas',
    modulo: 'REPORTES',
    permiso: 'reportes:exportar',
    colorKey: 'primary',
    bgKey: 'primaryLight',
  },
];

export const CATEGORIAS: { id: CategoriaModulo; titulo: string }[] = [
  { id: 'quick', titulo: 'Acceso rápido' },
  { id: 'admin', titulo: 'Administración' },
  { id: 'finanzas', titulo: 'Finanzas y reportes' },
];

export function filtrarModulo(modulo: ModuloItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    modulo.label.toLowerCase().includes(q) ||
    (modulo.sublabel ?? '').toLowerCase().includes(q)
  );
}