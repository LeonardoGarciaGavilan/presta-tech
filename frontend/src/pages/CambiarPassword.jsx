import { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import AuthCard from "../components/auth/AuthCard";
import AuthInput from "../components/auth/AuthInput";
import PasswordStrength from "../components/auth/PasswordStrength";

export default function CambiarPassword() {
  const [password,  setPassword]  = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPw1,   setShowPw1]   = useState(false);
  const [showPw2,   setShowPw2]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const navigate = useNavigate();

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (password !== confirmar) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true);
    try {
      await api.post("/usuarios/cambiar-password", { nuevaPassword: password });
      await api.post("/auth/logout");
      localStorage.removeItem("user");
      navigate("/");
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : msg ?? "Error al cambiar la contraseña");
    } finally { setLoading(false); }
  };

  const confirmBorderClass = confirmar
    ? confirmar !== password
      ? "border-red-500/40 focus:ring-red-500/30"
      : "border-emerald-500/40 focus:ring-emerald-500/30"
    : "border-gray-200";

  const confirmRightSlot = confirmar && (
    confirmar === password
      ? <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      : <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
  );

  return (
    <AuthLayout maxWidth="max-w-sm" showCenterBlur={false}>
      <AuthCard className="rounded-3xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold auth-text-primary">Cambiar contraseña</h1>
          <p className="text-sm text-blue-600/80 mt-1">Es tu primer acceso. Elige una contraseña segura para continuar.</p>
        </div>

        <div className="mb-5 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 auth-stagger-1">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-xs text-amber-700 leading-relaxed">Tu cuenta usa una contraseña temporal. Debes cambiarla antes de continuar.</p>
        </div>

        {error && (
          <div role="alert" className="mb-5 flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 error-shake">
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="auth-stagger-2 space-y-4">
            <AuthInput
              id="nuevaPassword"
              label="Nueva contraseña"
              type={showPw1 ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Mínimo 6 caracteres"
              required
            inputClassName="text-sm placeholder:text-gray-400"
            labelClassName="block text-xs font-semibold auth-label uppercase tracking-wider mb-2"
            iconClassName="text-blue-400"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
              showPasswordToggle
              showPassword={showPw1}
              onTogglePassword={() => setShowPw1(!showPw1)}
              eyeClassName="text-gray-400 hover:text-gray-600"
              autoComplete="new-password"
            />

            <PasswordStrength password={password} />
          </div>

          <div className="auth-stagger-3 space-y-4">
            <AuthInput
              id="confirmarPassword"
              label="Confirmar contraseña"
              type={showPw2 ? "text" : "password"}
              value={confirmar}
              onChange={(e) => { setConfirmar(e.target.value); setError(""); }}
              placeholder="Repite la contraseña"
              required
            inputClassName={`text-sm placeholder:text-gray-400 ${confirmBorderClass}`}
            labelClassName="block text-xs font-semibold auth-label uppercase tracking-wider mb-2"
            iconClassName="text-blue-400"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
              showPasswordToggle
              showPassword={showPw2}
              onTogglePassword={() => setShowPw2(!showPw2)}
              eyeClassName="text-gray-400 hover:text-gray-600"
              autoComplete="new-password"
              rightSlot={confirmRightSlot}
            />

            <button type="submit" disabled={loading || (confirmar !== "" && confirmar !== password)}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/70 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-[0.98] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Actualizando…</>
              : <>Establecer nueva contraseña <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
            }
          </button>
          </div>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">Sistema de Préstamos · {new Date().getFullYear()}</p>
      </AuthCard>
    </AuthLayout>
  );
}
