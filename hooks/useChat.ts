// Fix: Use namespace import for React for consistency.
import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { ai } from '../services/geminiService';
import { getSystemInstruction, initialBotMessage } from '../constants';
import type { DocumentData, ChatMessage } from '../types';

export const useChat = (document: DocumentData, onChatHistoryChange: (history: ChatMessage[]) => void) => {
    const { dispatch } = useDocuments();
    const [isBotTyping, setIsBotTyping] = React.useState(false);

    const handleSendMessage = React.useCallback(async (messageText: string) => {
        let currentChat = document.chat;
        const text = messageText.trim();
        if (!text || isBotTyping) return;

        // Re-initialize chat if it's missing (e.g., after a refresh)
        if (!currentChat && document.documentContent) {
            try {
                const historyForModel = document.chatHistory
                    .slice(1) 
                    .filter(msg => !msg.type) 
                    .map(msg => ({
                        role: msg.sender === 'user' ? 'user' as const : 'model' as const,
                        parts: [{ text: msg.text }]
                    }));

                const newChat = ai.chats.create({
                    model: document.model,
                    config: { systemInstruction: getSystemInstruction(document.answerScope, document.monkeyMode) },
                    history: [
                        { role: "user", parts: [{ text: `Here is the document I'veuploaded. All of your answers must be based on this content. DOCUMENT CONTENT:\n"""${document.documentContent}"""` }] },
                        { role: "model", parts: [{ text: initialBotMessage.text }] },
                        ...historyForModel
                    ],
                });
                dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId: document.id, updates: { chat: newChat } } });
                currentChat = newChat;
            } catch (error) {
                 console.error("Failed to re-initialize chat:", error);
                 const errorMessage: ChatMessage = { sender: 'bot', text: "Sorry, I couldn't reconnect to the chat session. Please try reloading.", wasMonkeyMode: document.monkeyMode };
                 onChatHistoryChange([...document.chatHistory, errorMessage]);
                 return;
            }
        }
        
        if (!currentChat) return;

        setIsBotTyping(true);
        const historyWithUserMessage: ChatMessage[] = [...document.chatHistory, { sender: 'user', text }];
        onChatHistoryChange(historyWithUserMessage);
        
        try {
            const [userTokensRes, response] = await Promise.all([
                ai.models.countTokens({ model: document.model, contents: { parts: [{ text }] } }),
                currentChat.sendMessage({ message: text })
            ]);

            const botResponseText = response.text;
            const botTokensRes = await ai.models.countTokens({ model: document.model, contents: { parts: [{ text: botResponseText }] } });
            
            const newTokens = userTokensRes.totalTokens + botTokensRes.totalTokens;
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: { docId: document.id, updates: { tokenCount: (document.tokenCount || 0) + newTokens } }
            });

            const quizSuggestionMatch = botResponseText.includes('<goto_quiz_tab />');
            if (quizSuggestionMatch) {
                const cleanText = botResponseText.replace('<goto_quiz_tab />', '').trim();
                const suggestionMessage: ChatMessage = {
                    sender: 'bot',
                    text: cleanText || "Great idea! Let's head over to the Quiz tab to create a test for you. ✨",
                    type: 'quiz_suggestion',
                    wasMonkeyMode: document.monkeyMode
                };
                onChatHistoryChange([...historyWithUserMessage, suggestionMessage]);
            } else {
                 const botMessage: ChatMessage = { sender: 'bot', text: botResponseText, wasMonkeyMode: document.monkeyMode };
                 onChatHistoryChange([...historyWithUserMessage, botMessage]);
            }
        } catch(e) {
            console.error("Error sending message:", e);
            const errorMessage: ChatMessage = { sender: 'bot', text: "Sorry, I encountered an error. Please try again. 🙏", wasMonkeyMode: document.monkeyMode };
            onChatHistoryChange([...historyWithUserMessage, errorMessage]);
        } finally {
            setIsBotTyping(false);
        }
    }, [document, isBotTyping, onChatHistoryChange, dispatch]);

    const changeChatContext = React.useCallback(async (updates: Partial<DocumentData>) => {
        if (!document.documentContent) {
            console.error("Document content is not available to change context.");
            return;
        }

        const newScope = updates.answerScope || document.answerScope;
        const newMode = updates.monkeyMode ?? document.monkeyMode;

        const historyForModel = document.chatHistory
            .slice(1)
            .filter(msg => !msg.type)
            .map(msg => ({
                role: msg.sender === 'user' ? 'user' as const : 'model' as const,
                parts: [{ text: msg.text }]
            }));

        try {
            const newChat = ai.chats.create({
                model: document.model,
                config: { systemInstruction: getSystemInstruction(newScope, newMode) },
                history: [
                    { role: "user", parts: [{ text: `Here is the document I've uploaded. All of your answers must be based on this content. DOCUMENT CONTENT:\n"""${document.documentContent}"""` }] },
                    { role: "model", parts: [{ text: initialBotMessage.text }] },
                    ...historyForModel
                ],
            });

            let statusMessage: ChatMessage;
            if (updates.answerScope) {
                 statusMessage = {
                    sender: 'bot',
                    text: newScope === 'document'
                        ? "My focus is narrowed.\nI will now answer questions based only on the document."
                        : "My scope has expanded!\nI can now use my general knowledge to answer your questions.",
                    type: 'scope_change',
                };
            } else {
                statusMessage = {
                    sender: 'bot',
                    text: newMode
                        ? "Ooki-ooki! The clever, mischievous monkey is here! 🍌 I'll be answering from now on! Eek!"
                        : "Phew, that's enough mischief for now. Back to serious study mode.",
                    type: 'monkey_mode_status',
                };
            }
           
            dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: {
                    docId: document.id,
                    updates: { chat: newChat, ...updates, chatHistory: [...document.chatHistory, statusMessage] }
                }
            });
        } catch (error) {
            console.error("Failed to recreate chat session:", error);
        }
    }, [document, dispatch]);

    const handleScopeChange = (newScope: 'document' | 'general') => changeChatContext({ answerScope: newScope });
    const handleMonkeyModeChange = (newMode: boolean) => changeChatContext({ monkeyMode: newMode });

    return {
        isBotTyping,
        handleSendMessage,
        handleScopeChange,
        handleMonkeyModeChange,
    };
};