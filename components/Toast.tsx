import React from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    exiting: boolean;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

let nextId = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = React.useState<Toast[]>([]);

    const removeToast = React.useCallback((id: number) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300);
    }, []);

    const showToast = React.useCallback((message: string, type: ToastType = 'info') => {
        const id = nextId++;
        setToasts(prev => {
            const next = [...prev, { id, message, type, exiting: false }];
            return next.length > 3 ? next.slice(next.length - 3) : next;
        });
        setTimeout(() => removeToast(id), 3000);
    }, [removeToast]);

    const colorMap: Record<ToastType, string> = {
        success: 'bg-success-600',
        error: 'bg-danger-600',
        info: 'bg-brand-600',
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div
                className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 items-end pointer-events-none"
                role="region"
                aria-label="Notifications"
                aria-live="polite"
            >
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        role={toast.type === 'error' ? 'alert' : 'status'}
                        className={[
                            'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-pop text-white text-sm font-semibold max-w-xs',
                            'transition-all duration-300 ring-1 ring-white/10',
                            colorMap[toast.type],
                            toast.exiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0 animate-fade-in-up',
                        ].join(' ')}
                    >
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextValue => {
    const ctx = React.useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
};
