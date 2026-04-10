// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import CambiarPassword from "./pages/CambiarPassword";
import Dashboard from "./pages/Dashboard";
import DashboardLayout from "./layout/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Clientes from "./pages/Clientes";
import Prestamos from "./pages/Prestamos";
import NuevoPrestamo from "./pages/NuevoPrestamo";
import DetallePrestamo from "./pages/DetallePrestamo";
import Pagos from "./pages/Pagos";
import Configuracion from "./pages/Configuracion";
import Perfil from "./pages/Perfil";
import Usuarios from "./pages/Usuario";
import Reportes from "./pages/Reportes";
import Gastos from "./pages/Gastos";
import Amortizacion from "./pages/Amortizacion";
import CierreCaja from "./pages/CierreCaja";
import SuperAdmin from "./pages/SuperAdmin";
import { useAuth } from "./context/AuthContext";
import Rutas from "./pages/Rutas";
import Alertas from "./pages/Alertas";
import Finanzas from "./pages/Finanzas";
import Empleados from "./pages/Empleados";
import Auditoria from "./pages/Auditoria";
import OfflineBanner from "./components/OfflineBanner";
import UpdatePrompt from "./components/UpdatePrompt";

// ─── Guard exclusivo para SUPERADMIN ─────────────────────────────────────────
function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.rol !== "SUPERADMIN") {
    window.location.href = "/";
    return null;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <UpdatePrompt />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/cambiar-password" element={<CambiarPassword />} />

        {/* ── Panel SuperAdmin — sin DashboardLayout ── */}
        <Route path="/superadmin" element={
          <SuperAdminRoute><SuperAdmin /></SuperAdminRoute>
        } />

        {/* ── App normal ── */}
        <Route path="/dashboard" element={
          <ProtectedRoute><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/clientes" element={
          <ProtectedRoute><DashboardLayout><Clientes /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/prestamos" element={
          <ProtectedRoute><DashboardLayout><Prestamos /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/prestamos/nuevo" element={
          <ProtectedRoute><DashboardLayout><NuevoPrestamo /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/prestamos/:id" element={
          <ProtectedRoute><DashboardLayout><DetallePrestamo /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/pagos" element={
          <ProtectedRoute><DashboardLayout><Pagos /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/configuracion" element={
          <ProtectedRoute><DashboardLayout><Configuracion /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/perfil" element={
          <ProtectedRoute><DashboardLayout><Perfil /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/usuarios" element={
          <ProtectedRoute><DashboardLayout><Usuarios /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/reportes" element={
          <ProtectedRoute><DashboardLayout><Reportes /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/gastos" element={
          <ProtectedRoute><DashboardLayout><Gastos /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/amortizacion" element={
          <ProtectedRoute><DashboardLayout><Amortizacion /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/caja" element={
          <ProtectedRoute><DashboardLayout><CierreCaja /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/rutas" element={
          <ProtectedRoute><DashboardLayout><Rutas /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/alertas" element={
          <ProtectedRoute><DashboardLayout><Alertas /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/finanzas" element={
          <ProtectedRoute><DashboardLayout><Finanzas /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/empleados" element={
          <ProtectedRoute><DashboardLayout><Empleados /></DashboardLayout></ProtectedRoute>
        } />
        <Route path="/auditoria" element={
          <ProtectedRoute><DashboardLayout><Auditoria /></DashboardLayout></ProtectedRoute>
        } />

        {/* ── Auditoría Global para SUPERADMIN ── */}
        <Route path="/superadmin/auditoria" element={
          <SuperAdminRoute><DashboardLayout><Auditoria /></DashboardLayout></SuperAdminRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;