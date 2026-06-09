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

// Map noisy upstream (Gemini) errors to short, friendly Korean copy.
const friendlyError = (raw: string): string => {
    if (/overload|high demand|currently unavailable|UNAVAILABLE|temporar|\b50[023]\b|spikes in demand/i.test(raw)) {
        return 'AI 모델이 잠시 혼잡합니다. 보통 일시적이에요 — 잠시 후 다시 시도해 주세요.';
    }
    if (/quota|RESOURCE_EXHAUSTED|daily.*limit|한도/i.test(raw)) {
        return '오늘 사용 한도에 도달했어요. 잠시 후 또는 내일 다시 시도해 주세요.';
    }
    if (/rate.?limit|too many requests|\b429\b/i.test(raw)) {
        return '요청이 잠시 몰렸어요. 잠깐 후 다시 시도해 주세요.';
    }
    return raw;
};

// A function to get a user-friendly error message from an unknown error type.
export const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return friendlyError(error.message);
    }
    if (typeof error === 'string') {
        return friendlyError(error);
    }
    return 'An unexpected error occurred. Please try again.';
};
