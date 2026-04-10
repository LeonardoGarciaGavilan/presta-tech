import useSWUpdate from '../hooks/useSWUpdate';
import toast from 'react-hot-toast';

export default function UpdatePrompt() {
  const { updateAvailable, updateApp } = useSWUpdate();

  const handleUpdate = async () => {
    const success = await updateApp();
    if (!success) {
      window.location.reload();
    }
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
      <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 shadow-2xl flex items-center gap-4">
        <div className="flex-1">
          <p className="text-white font-medium text-sm">Nueva versión disponible</p>
          <p className="text-slate-400 text-xs">Actualiza para obtener las últimas mejoras</p>
        </div>
        <button
          onClick={handleUpdate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
