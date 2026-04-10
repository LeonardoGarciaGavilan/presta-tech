import usePWAInstall from '../hooks/usePWAInstall';
import toast from 'react-hot-toast';

export default function InstallPWAButton() {
  const { canInstall, install } = usePWAInstall();

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      toast.success('App instalada correctamente');
    }
  };

  if (!canInstall) return null;

  return (
    <button
      onClick={handleInstall}
      className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Instalar Presta Tech
    </button>
  );
}
