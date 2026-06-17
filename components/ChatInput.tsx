// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import { MicrophoneIcon, SendIcon } from './icons';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface ChatInputProps {
    isBotTyping: boolean;
    isMonkeyMode?: boolean;
    onSendMessage: (message: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ isBotTyping, isMonkeyMode = false, onSendMessage }) => {
    const [userInput, setUserInput] = React.useState('');
    
    const { isListening, toggleListening, isSupported } = useSpeechRecognition(setUserInput);

    const handleSend = () => {
        if (userInput.trim()) {
            onSendMessage(userInput);
            setUserInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    
    const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setUserInput(e.target.value);
        // Auto-resize textarea
        const target = e.currentTarget;
        target.style.height = 'auto';
        target.style.height = `${target.scrollHeight}px`;
    };

    return (
        <div
            className={[
                'flex items-start gap-2 rounded-xl border bg-white p-1.5 transition-colors focus-within:ring-2',
                isMonkeyMode
                    ? 'border-yellow-400 focus-within:border-yellow-500 focus-within:ring-yellow-500/20'
                    : 'border-ink-300 focus-within:border-brand-400 focus-within:ring-brand-500/15',
            ].join(' ')}
        >
            <button
                onClick={toggleListening}
                disabled={!isSupported}
                className={`flex-shrink-0 p-2 rounded-full ${isListening ? 'text-danger-500 bg-danger-100' : 'text-ink-500 hover:bg-ink-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label={isListening ? 'Stop listening' : 'Start listening'}
                title={!isSupported ? "Speech recognition is not supported by your browser." : (isListening ? 'Stop listening' : 'Start listening')}
            >
                <MicrophoneIcon className="text-2xl" />
            </button>
            <textarea
                rows={1}
                value={userInput}
                onChange={handleTextAreaChange}
                onKeyDown={handleKeyDown}
                // maxLength matches the server-side chat message cap
                // (20,000 chars in netlify/functions/gemini.ts) so the
                // browser caps before a paste of giant text trips the
                // server validation.
                maxLength={20000}
                placeholder="Ask a question..."
                className="w-full border-none focus:ring-0 focus:outline-none resize-none bg-transparent py-3 text-base placeholder-ink-500 text-ink-900"
                style={{ minHeight: '56px', maxHeight: '150px' }}
                disabled={isBotTyping}
                aria-label="Chat input"
            />
            <button
                onClick={handleSend}
                disabled={isBotTyping || !userInput.trim()}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-ink-200 text-ink-700 flex items-center justify-center self-end disabled:bg-ink-200 disabled:cursor-not-allowed enabled:bg-brand-600 enabled:text-white hover:enabled:bg-brand-700 enabled:shadow-brand transition-colors"
                aria-label="Send message"
            >
                <SendIcon className="text-xl" />
            </button>
        </div>
    );
};
