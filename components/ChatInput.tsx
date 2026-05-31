// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import { MicrophoneIcon } from './icons';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface ChatInputProps {
    isBotTyping: boolean;
    onSendMessage: (message: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ isBotTyping, onSendMessage }) => {
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
        <div className="flex items-start gap-2 p-1.5 bg-white border border-slate-300 rounded-xl focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/15 transition-colors">
            <button
                onClick={toggleListening}
                disabled={!isSupported}
                className={`flex-shrink-0 p-2 rounded-full ${isListening ? 'text-red-500 bg-red-100' : 'text-slate-500 hover:bg-slate-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
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
                placeholder="Ask a question..."
                className="w-full border-none focus:ring-0 focus:outline-none resize-none bg-transparent py-3 text-base placeholder-slate-500 text-slate-900"
                style={{ minHeight: '56px', maxHeight: '150px' }}
                disabled={isBotTyping}
                aria-label="Chat input"
            />
            <button
                onClick={handleSend}
                disabled={isBotTyping || !userInput.trim()}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center self-end disabled:bg-slate-200 disabled:cursor-not-allowed enabled:bg-brand-600 enabled:text-white hover:enabled:bg-brand-700 enabled:shadow-brand transition-colors"
                aria-label="Send message"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
            </button>
        </div>
    );
};