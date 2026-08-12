// frontend/src/components/PermisoRoute.jsx
// Guard de ruta: autenticación + permiso efectivo. Si el usuario no tiene el
// permiso muestra <AccesoDenegado /> en vez de redirigir (el sidebar ya oculta
// los items sin permiso). El backend sigue siendo la autoridad real.
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { tienePermiso } from "../utils/permisos";
import AccesoDenegado from "./AccesoDenegado";

export default function PermisoRoute({ permiso, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (permiso && !tienePermiso(user, permiso)) {
    return <AccesoDenegado />;
  }

  return children;
}
