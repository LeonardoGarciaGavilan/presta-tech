// frontend/src/components/AccesoDenegado.jsx
export default function AccesoDenegado() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0 0h.01M12 7v5m-8 4l8 5 8-5V5l-8-5-8 5v11z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Acceso denegado</h2>
      <p className="text-slate-400 max-w-sm text-sm">
        No tienes permiso para ver esta sección. Contacta al administrador de tu
        empresa si crees que deberías tener acceso.
      </p>
    </div>
  );
}
