import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { geminiProxy } from '../services/geminiService';
import { getSystemInstruction } from '../constants';
import type { DocumentData, ChatMessage } from '../types';

export const useChat = (document: DocumentData, onChatHistoryChange: (history: ChatMessage[]) => void) => {
  const { dispatch } = useDocuments();
  const [isBotTyping, setIsBotTyping] = React.useState(false);

  const handleSendMessage = React.useCallback(
    async (messageText: string) => {
      const text = messageText.trim();
      if (!text || isBotTyping) return;
      if (!document.documentContent) return;

      setIsBotTyping(true);
      const historyWithUserMessage: ChatMessage[] = [...document.chatHistory, { sender: 'user', text }];
      onChatHistoryChange(historyWithUserMessage);

      try {
        const [userTokens, botResponseText] = await Promise.all([
          geminiProxy.countTokens(document.model, text),
          geminiProxy.sendChatMessage({
            model: document.model,
            systemInstruction: getSystemInstruction(document.answerScope, document.monkeyMode),
            documentContent: document.documentContent,
            chatHistory: historyWithUserMessage,
            message: text,
          }),
        ]);

        const botTokens = await geminiProxy.countTokens(document.model, botResponseText);
        const newTokens = userTokens + botTokens;

        dispatch({
          type: 'UPDATE_DOCUMENT',
          payload: { docId: document.id, updates: { tokenCount: (document.tokenCount || 0) + newTokens } },
        });

        const quizSuggestionMatch = botResponseText.includes('<goto_quiz_tab />');
        if (quizSuggestionMatch) {
          const cleanText = botResponseText.replace('<goto_quiz_tab />', '').trim();
          const suggestionMessage: ChatMessage = {
            sender: 'bot',
            text: cleanText || "Great idea! Let's head over to the Quiz tab to create a test for you. ✨",
            type: 'quiz_suggestion',
            wasMonkeyMode: document.monkeyMode,
          };
          onChatHistoryChange([...historyWithUserMessage, suggestionMessage]);
        } else {
          const botMessage: ChatMessage = { sender: 'bot', text: botResponseText, wasMonkeyMode: document.monkeyMode };
          onChatHistoryChange([...historyWithUserMessage, botMessage]);
        }
      } catch (e) {
        console.error('Error sending message:', e);
        const errorMessage: ChatMessage = {
          sender: 'bot',
          text: 'Sorry, I encountered an error. Please try again. 🙏',
          wasMonkeyMode: document.monkeyMode,
        };
        onChatHistoryChange([...historyWithUserMessage, errorMessage]);
      } finally {
        setIsBotTyping(false);
      }
    },
    [document, isBotTyping, onChatHistoryChange, dispatch]
  );

  const changeChatContext = React.useCallback(
    async (updates: Partial<DocumentData>) => {
      if (!document.documentContent) {
        console.error('Document content is not available to change context.');
        return;
      }

      const newScope = updates.answerScope || document.answerScope;
      const newMode = updates.monkeyMode ?? document.monkeyMode;

      let statusMessage: ChatMessage;
      if (updates.answerScope) {
        statusMessage = {
          sender: 'bot',
          text:
            newScope === 'document'
              ? 'My focus is narrowed.\nI will now answer questions based only on the document.'
              : 'My scope has expanded!\nI can now use my general knowledge to answer your questions.',
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
          updates: { ...updates, chatHistory: [...document.chatHistory, statusMessage] },
        },
      });
    },
    [document, dispatch]
  );

  const handleScopeChange = (newScope: 'document' | 'general') => changeChatContext({ answerScope: newScope });
  const handleMonkeyModeChange = (newMode: boolean) => changeChatContext({ monkeyMode: newMode });

  return {
    isBotTyping,
    handleSendMessage,
    handleScopeChange,
    handleMonkeyModeChange,
  };
};
