import { useToast } from '../context/ToastContext';

const typeStyles: Record<string, string> = {
  success: 'bg-green-500 text-white',
  error: 'bg-red-500 text-white',
  warning: 'bg-yellow-400 text-yellow-900',
  info: 'bg-blue-500 text-white',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();
  return (
    <div className="fixed top-4 right-2 sm:right-4 left-2 sm:left-auto z-[9999] space-y-2 max-w-sm ml-auto">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm w-full ${typeStyles[t.type] || typeStyles.info}`}
          role="alert"
          aria-live="polite"
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="ml-2 opacity-70 hover:opacity-100" aria-label="Dismiss notification">✕</button>
        </div>
      ))}
    </div>
  );
}
