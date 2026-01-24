// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';

export const Spinner: React.FC = () => (
    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
);