import { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

if (typeof document !== "undefined" && !document.getElementById("cambiar-pw-styles")) {
  const s = document.createElement("style");
  s.id = "cambiar-pw-styles";
  s.textContent = `
    @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shake  { 0%,100% { transform:translateX(0); } 25% { transform:translateX(-4px); } 75% { transform:translateX(4px); } }
  `;
  document.head.appendChild(s);
}

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
      // 🔒 El token viene en cookie httpOnly - el logout limpia la cookie automáticamente
      await api.post("/auth/logout");
      localStorage.removeItem("user");
      navigate("/");
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : msg ?? "Error al cambiar la contraseña");
    } finally { setLoading(false); }
  };

  const fortaleza = (() => {
    if (!password) return null;
    if (password.length < 6)  return { label:"Muy corta", color:"bg-red-500",    w:"w-1/4" };
    if (password.length < 8)  return { label:"Débil",     color:"bg-orange-400", w:"w-2/4" };
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password))
                              return { label:"Regular",   color:"bg-amber-400",  w:"w-3/4" };
    return                           { label:"Fuerte",    color:"bg-emerald-500",w:"w-full" };
  })();

  const EyeBtn = ({ show, toggle }) => (
    <button type="button" onClick={toggle}
      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
      {show
        ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
        : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
      }
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm" style={{ animation:"fadeUp 0.4s ease both" }}>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/40">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">Cambiar contraseña</h1>
            <p className="text-sm text-blue-300/70 mt-1">Es tu primer acceso. Elige una contraseña segura para continuar.</p>
          </div>

          <div className="mb-5 flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-xs text-amber-300/80 leading-relaxed">Tu cuenta usa una contraseña temporal. Debes cambiarla antes de continuar.</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3" style={{ animation:"shake 0.3s ease" }}>
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-blue-200/70 uppercase tracking-wider mb-2">Nueva contraseña</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400/60">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <input type={showPw1 ? "text" : "password"} value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Mínimo 6 caracteres" required
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" />
                <EyeBtn show={showPw1} toggle={() => setShowPw1(!showPw1)} />
              </div>
              {fortaleza && (
                <div className="mt-2">
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${fortaleza.color} ${fortaleza.w}`} />
                  </div>
                  <p className={`text-xs mt-1 font-medium ${fortaleza.label==="Fuerte"?"text-emerald-400":fortaleza.label==="Regular"?"text-amber-400":"text-red-400"}`}>{fortaleza.label}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-blue-200/70 uppercase tracking-wider mb-2">Confirmar contraseña</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400/60">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <input type={showPw2 ? "text" : "password"} value={confirmar}
                  onChange={(e) => { setConfirmar(e.target.value); setError(""); }}
                  placeholder="Repite la contraseña" required
                  className={`w-full bg-white/5 border rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 transition-all ${
                    confirmar && confirmar !== password ? "border-red-500/40 focus:ring-red-500/30"
                    : confirmar && confirmar === password ? "border-emerald-500/40 focus:ring-emerald-500/30"
                    : "border-white/10 focus:ring-blue-500/50 focus:border-blue-500/50"
                  }`} />
                <EyeBtn show={showPw2} toggle={() => setShowPw2(!showPw2)} />
                {confirmar && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2">
                    {confirmar === password
                      ? <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      : <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    }
                  </div>
                )}
              </div>
            </div>

            <button type="submit" disabled={loading || (confirmar !== "" && confirmar !== password)}
              className="w-full mt-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Actualizando…</>
                : <>Establecer nueva contraseña <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
              }
            </button>
          </form>

          <p className="text-center text-xs text-white/20 mt-6">Sistema de Préstamos · {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}