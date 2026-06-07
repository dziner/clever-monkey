import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { geminiProxy } from '../services/geminiService';
import { getSystemInstruction } from '../constants';
import type { DocumentData, ChatMessage } from '../types';

export const useChat = (document: DocumentData, onChatHistoryChange: (history: ChatMessage[]) => void) => {
  const { dispatch } = useDocuments();
  const { userProfile } = useUser();
  const [isBotTyping, setIsBotTyping] = React.useState(false);

  // Keep a stable ref so callbacks don't need to re-create on every doc state update
  const documentRef = React.useRef(document);
  documentRef.current = document;

  const handleSendMessage = React.useCallback(
    async (messageText: string) => {
      const doc = documentRef.current;
      const text = messageText.trim();
      if (!text || isBotTyping) return;
      if (!doc.documentContent) return;

      setIsBotTyping(true);
      const historyWithUserMessage: ChatMessage[] = [...doc.chatHistory, { sender: 'user', text }];
      onChatHistoryChange(historyWithUserMessage);

      try {
        const [userTokens, botResponseText] = await Promise.all([
          geminiProxy.countTokens(doc.model, text),
          geminiProxy.sendChatMessage({
            model: doc.model,
            systemInstruction: getSystemInstruction(doc.answerScope, doc.monkeyMode),
            documentContent: doc.documentContent,
            chatHistory: historyWithUserMessage,
            message: text,
            language: userProfile?.language ?? null,
          }),
        ]);

        const botTokens = await geminiProxy.countTokens(doc.model, botResponseText);
        const newTokens = userTokens + botTokens;

        dispatch({
          type: 'UPDATE_DOCUMENT',
          payload: { docId: doc.id, updates: { tokenCount: (doc.tokenCount || 0) + newTokens } },
        });

        const quizSuggestionMatch = botResponseText.includes('<goto_quiz_tab />');
        if (quizSuggestionMatch) {
          const cleanText = botResponseText.replace('<goto_quiz_tab />', '').trim();
          const suggestionMessage: ChatMessage = {
            sender: 'bot',
            text: cleanText || "Great idea! Let's head over to the Quiz tab to create a test for you. ✨",
            type: 'quiz_suggestion',
            wasMonkeyMode: doc.monkeyMode,
          };
          onChatHistoryChange([...historyWithUserMessage, suggestionMessage]);
        } else {
          const botMessage: ChatMessage = { sender: 'bot', text: botResponseText, wasMonkeyMode: doc.monkeyMode };
          onChatHistoryChange([...historyWithUserMessage, botMessage]);
        }
      } catch (e) {
        console.error('Error sending message:', e);
        const errorMessage: ChatMessage = {
          sender: 'bot',
          text: 'Sorry, I encountered an error. Please try again. 🙏',
          wasMonkeyMode: doc.monkeyMode,
          isError: true,
        };
        onChatHistoryChange([...historyWithUserMessage, errorMessage]);
      } finally {
        setIsBotTyping(false);
      }
    },
    [isBotTyping, onChatHistoryChange, dispatch, userProfile?.language]
  );

  const changeChatContext = React.useCallback(
    async (updates: Partial<DocumentData>) => {
      const doc = documentRef.current;
      if (!doc.documentContent) {
        console.error('Document content is not available to change context.');
        return;
      }

      const newScope = updates.answerScope || doc.answerScope;
      const newMode = updates.monkeyMode ?? doc.monkeyMode;

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
          docId: doc.id,
          updates: { ...updates, chatHistory: [...doc.chatHistory, statusMessage] },
        },
      });
    },
    [dispatch]
  );

  const handleScopeChange = React.useCallback(
    (newScope: 'document' | 'general') => changeChatContext({ answerScope: newScope }),
    [changeChatContext]
  );
  const handleMonkeyModeChange = React.useCallback(
    (newMode: boolean) => changeChatContext({ monkeyMode: newMode }),
    [changeChatContext]
  );

  return {
    isBotTyping,
    handleSendMessage,
    handleScopeChange,
    handleMonkeyModeChange,
  };
};
