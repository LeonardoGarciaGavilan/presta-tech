import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";
import { setAccessTokenGlobal, getAccessToken } from "../utils/token";

const clearAllDashboardCache = () => {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("dashboard_cache_")) {
        localStorage.removeItem(key);
      }
    });
  } catch {}
};

const AuthContext = createContext();

const INACTIVIDAD_MS = 15 * 60 * 1000;
const AVISO_ANTES_MS = 2 * 60 * 1000;
const EVENTOS_ACTIVIDAD = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

// ═══════════════════════════════════════════════════════════════════════════
// MODAL DE LOGOUT REUTILIZABLE
// ═══════════════════════════════════════════════════════════════════════════
function LogoutModal({ isOpen, onClose, onLogoutSingle, onLogoutAll, isLoading, error }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-6 w-full max-w-md mx-4">
        <h3 className="text-xl font-semibold text-white mb-2">
          Cerrar sesión
        </h3>
        <p className="text-slate-400 mb-4">
          ¿Qué acción deseas realizar?
        </p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        
        <div className="space-y-3">
          <button
            onClick={onLogoutSingle}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v-1a2 2 0 00-2-2H5a2 2 0 00-2 2v1a2 2 0 002 2h2a2 2 0 002-2v-1m0-4V5a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            )}
            Cerrar solo esta sesión
          </button>
          
          <button
            onClick={onLogoutAll}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            Cerrar todas las sesiones
          </button>
        </div>
        
        <button
          onClick={onClose}
          disabled={isLoading}
          className="w-full mt-4 px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarAviso, setMostrarAviso] = useState(false);
  const [segsRestantes, setSegsRestantes] = useState(120);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState(null);

  const inactividadRef = useRef(null);
  const avisoRef = useRef(null);
  const countdownRef = useRef(null);
  const initializedRef = useRef(false);
  const isAuthenticatedRef = useRef(false);

  const clearSession = useCallback(() => {
    clearAllDashboardCache();
    localStorage.removeItem("user");
    setUser(null);
    isAuthenticatedRef.current = false;
    setAccessTokenGlobal(null);

    clearTimeout(inactividadRef.current);
    clearTimeout(avisoRef.current);
    clearInterval(countdownRef.current);

    window.location.href = "/";
  }, []);

  const validarSesion = useCallback(async (showErrors = false) => {
    try {
      const res = await api.get("/auth/me");
      const userData = res.data;

      setUser(userData);
      isAuthenticatedRef.current = true;
      localStorage.setItem("user", JSON.stringify(userData));

      return userData;
    } catch (err) {
      localStorage.removeItem("user");
      setUser(null);
      isAuthenticatedRef.current = false;

      if (showErrors) {
        setError("Error de conexión o sesión inválida");
      }

      return null;
    }
  }, []);

  const logout = useCallback(() => {
    setShowLogoutModal(true);
    setLogoutError(null);
  }, []);

  const handleLogoutSingle = useCallback(async () => {
    setLogoutLoading(true);
    setLogoutError(null);

    const token = getAccessToken();
    try {
      await api.post("/auth/logout", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      clearSession();
    } catch (err) {
      console.error("Logout error:", err);
      const errorMessage = err.response?.data?.message || 'Error al cerrar sesión. Intenta de nuevo.';
      setLogoutError(errorMessage);
      setLogoutLoading(false);
    }
  }, [clearSession]);

  const handleLogoutAll = useCallback(async () => {
    setLogoutLoading(true);
    setLogoutError(null);

    const token = getAccessToken();
    try {
      await api.post("/auth/logout-all", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      clearSession();
    } catch (err) {
      console.error("Logout all error:", err);
      const errorMessage = err.response?.data?.message || 'Error al cerrar todas las sesiones. Intenta de nuevo.';
      setLogoutError(errorMessage);
      setLogoutLoading(false);
    }
  }, [clearSession]);

  const closeLogoutModal = useCallback(() => {
    setShowLogoutModal(false);
    setLogoutError(null);
  }, []);

  const resetInactividad = useCallback(() => {
    if (!isAuthenticatedRef.current) return;

    setMostrarAviso(false);
    clearTimeout(inactividadRef.current);
    clearTimeout(avisoRef.current);
    clearInterval(countdownRef.current);

    avisoRef.current = setTimeout(() => {
      setSegsRestantes(120);
      setMostrarAviso(true);

      countdownRef.current = setInterval(() => {
        setSegsRestantes((s) => (s <= 1 ? 0 : s - 1));
      }, 1000);
    }, INACTIVIDAD_MS - AVISO_ANTES_MS);

    inactividadRef.current = setTimeout(() => {
      const token = getAccessToken();
      api.post("/auth/logout", {}, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
      clearSession();
    }, INACTIVIDAD_MS);
  }, [clearSession]);

  useEffect(() => {
    const handleActividad = () => resetInactividad();

    EVENTOS_ACTIVIDAD.forEach((ev) =>
      window.addEventListener(ev, handleActividad, { passive: true })
    );

    return () => {
      EVENTOS_ACTIVIDAD.forEach((ev) =>
        window.removeEventListener(ev, handleActividad)
      );
    };
  }, [resetInactividad]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initAuth = async () => {
      const cachedUser = localStorage.getItem("user");

      if (cachedUser) {
        try {
          const parsed = JSON.parse(cachedUser);
          setUser(parsed);
          isAuthenticatedRef.current = true;

          try {
            await api.get("/auth/me");
          } catch (err) {
            localStorage.removeItem("user");
            setUser(null);
            isAuthenticatedRef.current = false;
          }
        } catch {
          localStorage.removeItem("user");
        }
      }

      setLoading(false);
    };

    initAuth();

    return () => {
      clearTimeout(inactividadRef.current);
      clearTimeout(avisoRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  const login = useCallback((userData, accessToken = null) => {
    clearAllDashboardCache();
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    isAuthenticatedRef.current = true;
    setError(null);

    if (accessToken) {
      setAccessTokenGlobal(accessToken);
    }

    resetInactividad();
  }, [resetInactividad]);

  const refreshUser = useCallback(async () => {
    return await validarSesion(true);
  }, [validarSesion]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error, refreshUser }}>
      {children}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={closeLogoutModal}
        onLogoutSingle={handleLogoutSingle}
        onLogoutAll={handleLogoutAll}
        isLoading={logoutLoading}
        error={logoutError}
      />
      {mostrarAviso && user && (
        <div> { /* AvisoInactividad */ } </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
