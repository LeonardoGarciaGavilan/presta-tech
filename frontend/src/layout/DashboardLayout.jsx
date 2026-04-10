// DashboardLayout.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import Notificaciones from "../components/Notificaciones";
import InstallPWAButton from "../components/InstallPWAButton";
import api from "../services/api";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket";

const IconDashboard = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const IconClientes = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconPrestamos = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconLogout = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);
const IconChevron = ({ collapsed }) => (
  <svg className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const IconPagos = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
  </svg>
);
const IconConfig = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconPerfil = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconUsuario = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const IconReportes = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IconAmortizacion = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const IconGastos = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const IconCaja = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);
const IconRuta = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);
const IconAlertas = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);
const IconFinanzas = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const IconEmpleados = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const IconMenu = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const IconAuditoria = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IconX = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { to: "/clientes", label: "Clientes", Icon: IconClientes },
  { to: "/prestamos", label: "Préstamos", Icon: IconPrestamos },
  { to: "/pagos", label: "Pagos", Icon: IconPagos },
  { to: "/caja", label: "Cierre de Caja", Icon: IconCaja },
  { to: "/amortizacion", label: "Amortización", Icon: IconAmortizacion },
  { to: "/rutas", label: "Rutas", Icon: IconRuta },
  { to: "/alertas", label: "Alertas", Icon: IconAlertas, adminOnly: true, badge: true },
  { to: "/reportes", label: "Reportes", Icon: IconReportes, adminOnly: true },
  { to: "/gastos", label: "Gastos", Icon: IconGastos, adminOnly: true },
  { to: "/empleados", label: "Empleados", Icon: IconEmpleados, adminOnly: true },
  { to: "/finanzas", label: "Finanzas", Icon: IconFinanzas, adminOnly: true },
  { to: "/usuarios", label: "Usuarios", Icon: IconUsuario, adminOnly: true },
  { to: "/auditoria", label: "Auditoría", Icon: IconAuditoria, adminOnly: true },
  { to: "/configuracion", label: "Configuración", Icon: IconConfig, adminOnly: true },
  { to: "/perfil", label: "Perfil", Icon: IconPerfil },
  { to: "/superadmin/auditoria", label: "Auditoría del Sistema", Icon: IconAuditoria, superAdminOnly: true },
];

const NavItem = ({ to, label, Icon, collapsed, onClick, badgeCount }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) => `
      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
      transition-all duration-150 group relative
      ${isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "text-slate-400 hover:bg-white/8 hover:text-white"}
      ${collapsed ? "justify-center" : ""}
    `}
  >
    {({ isActive }) => (
      <>
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-300 rounded-r-full" />}
        <div className="relative">
          <Icon />
          {/* Badge en ícono cuando está colapsado */}
          {collapsed && badgeCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-[#0f172a]">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </div>
        {!collapsed && <span className="flex-1">{label}</span>}
        {/* Badge en texto cuando está expandido */}
        {!collapsed && badgeCount > 0 && (
          <span className={`min-w-[20px] h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center ${isActive ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
        {collapsed && (
          <span className="absolute left-full ml-3 px-2 py-1 rounded-md text-xs font-semibold bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg z-50 border border-white/10">
            {label}{badgeCount > 0 ? ` (${badgeCount})` : ""}
          </span>
        )}
      </>
    )}
  </NavLink>
);

export default function DashboardLayout({ children }) {
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertasBadge, setAlertasBadge] = useState(0);

  const isAdmin = user?.rol === "ADMIN";
  const isSuperAdmin = user?.rol === "SUPERADMIN";
  const initials = user?.empresa ? user.empresa.slice(0, 2).toUpperCase() : "ME";
  const navItems = NAV_ITEMS.filter(item => 
    (!item.adminOnly || isAdmin) && 
    (!item.superAdminOnly || isSuperAdmin)
  );

  // ── Badge de alertas — WebSocket puro, sin polling ──────────────────────────
  useEffect(() => {
    if (!isAdmin || isSuperAdmin || !user?.empresaId) return;

    // 1. Cargar contador inicial desde la API (una sola vez al montar)
    api.get("/prestamos/alertas/contador")
      .then(r => setAlertasBadge(r.data.count ?? 0))
      .catch(() => { });

    // 2. Conectar WebSocket pasando empresaId directamente
    connectSocket(user.empresaId);
    const socket = getSocket();

    const handleContador = ({ count }) => {
      setAlertasBadge(count ?? 0);
    };

    socket.on("contador_alertas", handleContador);

    // 3. Limpiar al desmontar
    return () => {
      socket.off("contador_alertas", handleContador);
      // No desconectar el socket aquí — lo usa también Alertas.jsx
      // disconnectSocket() solo al hacer logout
    };
  }, [isAdmin, isSuperAdmin, user?.empresaId]);

  // ── Desconectar WebSocket al hacer logout ────────────────────────────────────
  const handleLogout = () => {
    disconnectSocket();
    logout();
  };

  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const SidebarInner = ({ onNav }) => (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/8 ${collapsed && !onNav ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0 shadow-lg shadow-blue-900/40">
          {initials}
        </div>
        {(!collapsed || onNav) && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate leading-tight">{user?.empresa || "Mi Empresa"}</p>
            <p className="text-[10px] text-blue-400 font-medium uppercase tracking-widest">Sistema de Préstamos</p>
          </div>
        )}
      </div>

      {/* Badge rol */}
      {(!collapsed || onNav) && (
        <div className="px-4 pt-3 pb-1">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isSuperAdmin ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : isAdmin ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "bg-slate-500/20 text-slate-400 border border-slate-500/30"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isSuperAdmin ? "bg-purple-400" : isAdmin ? "bg-blue-400" : "bg-slate-400"}`} />
            {isSuperAdmin ? "Super Admin" : isAdmin ? "Administrador" : "Empleado"}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, Icon, badge }) => (
          <NavItem
            key={to} to={to} label={label} Icon={Icon}
            collapsed={collapsed && !onNav}
            onClick={onNav}
            badgeCount={badge && isAdmin ? alertasBadge : 0}
          />
        ))}
      </nav>

      {/* Usuario + logout */}
      <div className="px-3 pb-4 space-y-2 border-t border-white/8 pt-3">
        {(!collapsed || onNav) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
            <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
              {user?.nombre?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs text-white font-medium truncate">{user?.nombre || "Usuario"}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
        )}
        <button onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition-all group relative ${collapsed && !onNav ? "justify-center" : ""}`}>
          <IconLogout />
          {(!collapsed || onNav) && <span>Cerrar sesión</span>}
          {collapsed && !onNav && (
            <span className="absolute left-full ml-3 px-2 py-1 rounded-md text-xs font-semibold bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg z-50 border border-white/10">
              Cerrar sesión
            </span>
          )}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* SIDEBAR DESKTOP */}
      <aside className={`
        hidden md:flex flex-col relative
        ${collapsed ? "w-[72px]" : "w-60"}
        bg-[#0f172a] text-white
        transition-all duration-300 ease-in-out
        shadow-2xl shrink-0 z-10
      `}>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-blue-400 to-transparent" />
        <SidebarInner onNav={undefined} />
        <button onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[72px] w-6 h-6 rounded-full bg-[#0f172a] border border-white/15 flex items-center justify-center text-slate-400 hover:text-white transition-colors shadow-lg z-20">
          <IconChevron collapsed={collapsed} />
        </button>
      </aside>

      {/* DRAWER MÓVIL */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`
        fixed top-0 left-0 h-full w-72 z-40 md:hidden
        bg-[#0f172a] text-white flex flex-col
        transition-transform duration-300 ease-in-out shadow-2xl
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-blue-400 to-transparent" />
        <button onClick={() => setMobileOpen(false)}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-colors z-10">
          <IconX />
        </button>
        <SidebarInner onNav={() => setMobileOpen(false)} />
      </aside>

      {/* CONTENIDO */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors -ml-1">
              <IconMenu />
            </button>
            <span className="text-sm text-gray-500 hidden sm:block">
              Bienvenido, <span className="font-semibold text-gray-800">{user?.nombre || user?.email}</span>
            </span>
            <span className="text-sm font-semibold text-gray-800 sm:hidden truncate max-w-[140px]">
              {user?.empresa || user?.nombre || "Mi Empresa"}
            </span>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {isSuperAdmin && (
              <span className="hidden sm:inline text-xs bg-purple-50 text-purple-600 border border-purple-200 font-semibold px-2 py-0.5 rounded-full">
                Super Admin
              </span>
            )}
            {isAdmin && !isSuperAdmin && (
              <span className="hidden sm:inline text-xs bg-blue-50 text-blue-600 border border-blue-200 font-semibold px-2 py-0.5 rounded-full">
                Admin
              </span>
            )}
            <Notificaciones />
            <InstallPWAButton />
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-gray-400 font-medium">En línea</span>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}