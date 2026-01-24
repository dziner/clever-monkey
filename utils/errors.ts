export class AppError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AppError';
    }
}

export class GeminiApiError extends AppError {
    constructor(message: string) {
        super(`Gemini API Error: ${message}`);
        this.name = 'GeminiApiError';
    }
}

// A function to get a user-friendly error message from an unknown error type.
export const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'An unexpected error occurred. Please try again.';
};
