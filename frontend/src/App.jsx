// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import CambiarPassword from "./pages/CambiarPassword";
import Dashboard from "./pages/Dashboard";
import DashboardLayout from "./layout/DashboardLayout";
import PermisoRoute from "./components/PermisoRoute";
import { permisoDeRuta } from "./utils/rutaPermisos";
import Clientes from "./pages/Clientes";
import ClienteDetalle from "./pages/ClienteDetalle";
import Prestamos from "./pages/Prestamos";
import NuevoPrestamo from "./pages/NuevoPrestamo";
import DetallePrestamo from "./pages/DetallePrestamo";
import Pagos from "./pages/Pagos";
import Configuracion from "./pages/Configuracion";
import Perfil from "./pages/Perfil";
import Usuarios from "./pages/Usuario";
import Permisos from "./pages/Permisos";
import Reportes from "./pages/Reportes";
import Gastos from "./pages/Gastos";
import Amortizacion from "./pages/Amortizacion";
import CierreCaja from "./pages/CierreCaja";
import SuperAdmin from "./pages/SuperAdmin";
import { useAuth } from "./context/AuthContext";
import Rutas from "./pages/Rutas";
import Alertas from "./pages/Alertas";
import Finanzas from "./pages/Finanzas";
import AnalisisRutas from "./pages/AnalisisRutas";
import Empleados from "./pages/Empleados";
import Auditoria from "./pages/Auditoria";
import ControlCajas from "./pages/ControlCajas";
import OfflineBanner from "./components/OfflineBanner";
import useSWUpdate from "./hooks/useSWUpdate";

// ─── Guard exclusivo para SUPERADMIN ─────────────────────────────────────────
function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.rol !== "SUPERADMIN") {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  useSWUpdate();

  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/cambiar-password" element={<CambiarPassword />} />

        {/* ── Panel SuperAdmin — sin DashboardLayout ── */}
        <Route
          path="/superadmin"
          element={
            <SuperAdminRoute>
              <SuperAdmin />
            </SuperAdminRoute>
          }
        />

        {/* ── App normal ── */}
        <Route
          path="/dashboard"
          element={
            <PermisoRoute permiso={permisoDeRuta("/dashboard")}>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/clientes"
          element={
            <PermisoRoute permiso={permisoDeRuta("/clientes")}>
              <DashboardLayout>
                <Clientes />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/clientes/:id"
          element={
            <PermisoRoute permiso={permisoDeRuta("/clientes")}>
              <DashboardLayout>
                <ClienteDetalle />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/prestamos"
          element={
            <PermisoRoute permiso={permisoDeRuta("/prestamos")}>
              <DashboardLayout>
                <Prestamos />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/prestamos/nuevo"
          element={
            <PermisoRoute permiso={permisoDeRuta("/prestamos/nuevo")}>
              <DashboardLayout>
                <NuevoPrestamo />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/prestamos/:id"
          element={
            <PermisoRoute permiso={permisoDeRuta("/prestamos")}>
              <DashboardLayout>
                <DetallePrestamo />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/pagos"
          element={
            <PermisoRoute permiso={permisoDeRuta("/pagos")}>
              <DashboardLayout>
                <Pagos />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/configuracion"
          element={
            <PermisoRoute permiso={permisoDeRuta("/configuracion")}>
              <DashboardLayout>
                <Configuracion />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/perfil"
          element={
            <PermisoRoute permiso={permisoDeRuta("/perfil")}>
              <DashboardLayout>
                <Perfil />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <PermisoRoute permiso={permisoDeRuta("/usuarios")}>
              <DashboardLayout>
                <Usuarios />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/usuarios/:id/permisos"
          element={
            <PermisoRoute permiso={permisoDeRuta("/usuarios/:id/permisos")}>
              <DashboardLayout>
                <Permisos />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <PermisoRoute permiso={permisoDeRuta("/reportes")}>
              <DashboardLayout>
                <Reportes />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/gastos"
          element={
            <PermisoRoute permiso={permisoDeRuta("/gastos")}>
              <DashboardLayout>
                <Gastos />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/amortizacion"
          element={
            <PermisoRoute permiso={permisoDeRuta("/amortizacion")}>
              <DashboardLayout>
                <Amortizacion />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/caja"
          element={
            <PermisoRoute permiso={permisoDeRuta("/caja")}>
              <DashboardLayout>
                <CierreCaja />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/rutas"
          element={
            <PermisoRoute permiso={permisoDeRuta("/rutas")}>
              <DashboardLayout>
                <Rutas />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/alertas"
          element={
            <PermisoRoute permiso={permisoDeRuta("/alertas")}>
              <DashboardLayout>
                <Alertas />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/finanzas"
          element={
            <PermisoRoute permiso={permisoDeRuta("/finanzas")}>
              <DashboardLayout>
                <Finanzas />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/analisis-rutas"
          element={
            <PermisoRoute permiso={permisoDeRuta("/analisis-rutas")}>
              <DashboardLayout>
                <AnalisisRutas />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/empleados"
          element={
            <PermisoRoute permiso={permisoDeRuta("/empleados")}>
              <DashboardLayout>
                <Empleados />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/auditoria"
          element={
            <PermisoRoute permiso={permisoDeRuta("/auditoria")}>
              <DashboardLayout>
                <Auditoria />
              </DashboardLayout>
            </PermisoRoute>
          }
        />
        <Route
          path="/control-cajas"
          element={
            <PermisoRoute permiso={permisoDeRuta("/control-cajas")}>
              <DashboardLayout>
                <ControlCajas />
              </DashboardLayout>
            </PermisoRoute>
          }
        />

        {/* ── Auditoría Global para SUPERADMIN ── */}
        <Route
          path="/superadmin/auditoria"
          element={
            <SuperAdminRoute>
              <DashboardLayout>
                <Auditoria />
              </DashboardLayout>
            </SuperAdminRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
