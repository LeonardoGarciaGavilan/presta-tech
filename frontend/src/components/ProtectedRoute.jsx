import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading, error } = useAuth();

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

  if (error === 'backend_offline') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center p-8">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Backend no disponible</h2>
          <p className="text-gray-400">Verifica que el servidor esté corriendo en http://localhost:3000</p>
        </div>
      </div>
    );
  }

  // Solo redirigir si NO hay usuario (no por loading o error)
  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
}