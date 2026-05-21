import * as React from 'react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('Unhandled error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4 p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl">
                        ⚠️
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Something went wrong</h2>
                    <p className="text-sm text-slate-500 max-w-sm">{this.state.error?.message ?? 'An unexpected error occurred.'}</p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                    >
                        Reload App
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
