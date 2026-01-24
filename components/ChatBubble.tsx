// Fix: Use namespace import for React to resolve JSX intrinsic element errors.
import * as React from 'react';
import type { ChatMessage } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CleverMonkeyIcon } from './icons';

interface ChatBubbleProps {
    message: ChatMessage;
}

interface TypingIndicatorProps {
    isMonkeyMode?: boolean;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isMonkeyMode }) => {
    const dotColor = isMonkeyMode ? 'bg-yellow-600' : 'bg-slate-400';
    return (
        <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 ${dotColor} rounded-full animate-bounce`} style={{ animationDelay: '0s' }}></div>
            <div className={`w-2 h-2 ${dotColor} rounded-full animate-bounce`} style={{ animationDelay: '0.1s' }}></div>
            <div className={`w-2 h-2 ${dotColor} rounded-full animate-bounce`} style={{ animationDelay: '0.2s' }}></div>
        </div>
    );
};

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
    const isUser = message.sender === 'user';
    const isBot = message.sender === 'bot';

    if (message.type === 'monkey_mode_status') {
        const isEnabled = message.text.includes('monkey is here'); // Check if it's the "ON" message
        const emoji = isEnabled ? '🍌' : '📚';
        
        return (
            <div className="w-full my-3 px-2">
                <div className="bg-yellow-100 text-yellow-800 rounded-xl p-3 text-sm max-w-md mx-auto shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className="text-xl pt-0.5">{emoji}</span>
                        <p className="font-semibold">{message.text}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Handle special message types like scope changes
    if (message.type === 'scope_change') {
        const isExpanded = message.text.includes('expanded');
        const [title, description] = message.text.split('\n');
        const emoji = isExpanded ? '🌎' : '📚';
        
        const bgColor = isExpanded ? 'bg-orange-100' : 'bg-green-100';
        const textColor = isExpanded ? 'text-orange-800' : 'text-green-800';

        return (
            <div className={`w-full my-3 px-2`}>
                <div className={`${bgColor} ${textColor} rounded-xl p-3 text-sm max-w-md mx-auto shadow-sm`}>
                    <div className="flex items-start gap-3">
                        <span className="text-xl pt-0.5">{emoji}</span>
                        <div>
                            <p className="font-bold">{title}</p>
                            <p className="text-current/80">{description}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    const botBubbleStyle = message.wasMonkeyMode
        ? 'bg-yellow-50 border border-yellow-200 text-slate-800 rounded-bl-sm'
        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm';

    return (
        <div className={`message-bubble-wrapper flex items-start gap-2 w-full ${isUser ? 'justify-end mb-6' : 'justify-start mb-4'}`}>
            {isBot && (
                 <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${message.wasMonkeyMode ? 'bg-yellow-50' : 'bg-blue-50'}`}>
                    <CleverMonkeyIcon className={`w-9 h-9 ${message.wasMonkeyMode ? 'text-yellow-600' : 'text-blue-600'}`} />
                </div>
            )}
            
            <div className={`
                max-w-xl rounded-xl shadow-md
                ${isUser ? 'bg-blue-600 text-white rounded-br-sm' : botBubbleStyle}
            `}>
                <div className="px-4 py-3">
                    {isBot && message.text === '...' ? (
                        <TypingIndicator isMonkeyMode={message.wasMonkeyMode} />
                    ) : (
                        <MarkdownRenderer content={message.text} />
                    )}
                </div>
            </div>
        </div>
    );
};