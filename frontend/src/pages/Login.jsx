import { useState, useRef, useEffect } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/auth/AuthLayout";
import AuthCard from "../components/auth/AuthCard";
import AuthInput from "../components/auth/AuthInput";

const getSavedEmail = () => {
  try { return localStorage.getItem("emailRecordado") || ""; } catch { return ""; }
};

export default function Login() {
  const [email, setEmail] = useState(getSavedEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recordar, setRecordar] = useState(() => {
    try { return !!localStorage.getItem("emailRecordado"); } catch { return false; }
  });

  const emailRef = useRef(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      const { usuario, access_token, refresh_token, requiereCambioPassword } = res.data;

      if (recordar) {
        try { localStorage.setItem("emailRecordado", email); } catch {}
      } else {
        try { localStorage.removeItem("emailRecordado"); } catch {}
      }

      login(usuario, access_token || null, refresh_token || null);

      if (usuario.rol === "SUPERADMIN") {
        navigate("/superadmin");
        return;
      }
      if (requiereCambioPassword) {
        navigate("/cambiar-password");
        return;
      }
      navigate("/dashboard");
    } catch (err) {
      const data = err.response?.data;
      const minutos = data?.minutosRestantes;

      if (minutos) {
        setError(`Demasiados intentos. Intenta de nuevo en ${minutos} minuto(s).`);
      } else {
        const msg = data?.message;
        const msgStr = Array.isArray(msg) ? msg[0] : msg;
        setError(!msgStr || msgStr === "Unauthorized"
          ? "Correo o contraseña incorrectos."
          : msgStr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      handleLogin(e);
    }
  };

  const whatsappUrl = "https://wa.me/18496563073?text=Hola,%20tengo%20un%20problema%20para%20iniciar%20sesión%20en%20PrestaTech.%20¿Me%20pueden%20ayudar?";

  return (
    <AuthLayout>
      <AuthCard>
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold auth-text-primary">PrestaTech</h1>
          <p className="text-sm auth-text-secondary mt-1">Sistema de Gestión de Préstamos</p>
        </div>

        {error && (
          <div role="alert" className="mb-5 flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <AuthInput
            id="email"
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="correo@empresa.com"
            disabled={loading}
            autoFocus
            ref={emailRef}
            wrapperClassName="auth-stagger-1"
            autoComplete="email"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />

          <AuthInput
            id="password"
            label="Contraseña"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="••••••••"
            disabled={loading}
            onKeyDown={handleKeyDown}
            wrapperClassName="auth-stagger-2"
            autoComplete="current-password"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
            showPasswordToggle
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
          />

          <div className="auth-stagger-3">
            <div className="flex items-center">
              <input
                id="recordar"
                type="checkbox"
                checked={recordar}
                onChange={(e) => {
                  setRecordar(e.target.checked);
                  if (!e.target.checked) {
                    try { localStorage.removeItem("emailRecordado"); } catch {}
                  }
                }}
                disabled={loading}
                className="w-4 h-4 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500/50 focus:ring-offset-0 cursor-pointer disabled:opacity-50"
              />
              <label htmlFor="recordar" className="ml-2 text-sm auth-label cursor-pointer select-none">
                Recordar sesión
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/70 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  Iniciar sesión
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-4 auth-stagger-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-green-500/10 hover:border-green-500/40 hover:text-green-400 transition-all duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            ¿Problemas para iniciar? Chatea con nosotros
          </a>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 auth-stagger-3">
          © {new Date().getFullYear()} PrestaTech. Todos los derechos reservados.
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
