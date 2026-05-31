import * as React from 'react';
import { ErrorOutlineIcon } from './icons';

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
                <div className="flex flex-col items-center justify-center min-h-dvh bg-ink-50 gap-4 p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-danger-50 flex items-center justify-center">
                        <ErrorOutlineIcon className="text-3xl text-danger-600" />
                    </div>
                    <h2 className="text-xl font-display font-bold text-ink-900 tracking-tight">문제가 발생했습니다</h2>
                    <p className="text-sm text-ink-500 max-w-sm">{this.state.error?.message ?? '예상치 못한 오류가 발생했습니다.'}</p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-brand"
                    >
                        앱 새로고침
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
