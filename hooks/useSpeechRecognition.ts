// Fix: Use namespace import for React for consistency.
import * as React from 'react';

export const useSpeechRecognition = (onTranscriptChange: (transcript: string) => void) => {
    const [isListening, setIsListening] = React.useState(false);
    const recognitionRef = React.useRef<any>(null); // SpeechRecognition instance

    React.useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech Recognition not supported by this browser.");
            return;
        }

        recognitionRef.current = new SpeechRecognition();
        const recognition = recognitionRef.current;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
                .map((result: any) => result[0])
                .map((result) => result.transcript)
                .join('');
            onTranscriptChange(transcript);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };
    // This effect should only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleListening = React.useCallback(() => {
        if (!recognitionRef.current) return;
        
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    }, [isListening]);

    return {
        isListening,
        toggleListening,
        isSupported: !!recognitionRef.current,
    };
};