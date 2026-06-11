import * as React from 'react';
import { useDocuments } from '../contexts/DocumentContext';
import { useUser } from '../contexts/UserContext';
import { geminiProxy } from '../services/geminiService';
import { estimateTokens } from '../utils/promptBudget';
import { getSystemInstruction } from '../constants';
import { t } from '../services/uiStrings';
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
        const botResponseText = await geminiProxy.sendChatMessage({
          model: doc.model,
          systemInstruction: getSystemInstruction(doc.answerScope, doc.monkeyMode),
          documentContent: doc.documentContent,
          chatHistory: historyWithUserMessage,
          message: text,
          language: userProfile?.language ?? null,
        });

        // The token counter is display-only; a local estimate avoids the
        // two countTokens API round-trips this used to spend per message.
        const newTokens = estimateTokens(text) + estimateTokens(botResponseText);

        dispatch({
          type: 'UPDATE_DOCUMENT',
          payload: { docId: doc.id, updates: { tokenCount: (doc.tokenCount || 0) + newTokens } },
        });

        const quizSuggestionMatch = botResponseText.includes('<goto_quiz_tab />');
        if (quizSuggestionMatch) {
          const cleanText = botResponseText.replace('<goto_quiz_tab />', '').trim();
          const suggestionMessage: ChatMessage = {
            sender: 'bot',
            text: cleanText || t('chat.quizSuggestionFallback', userProfile?.language),
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
          text: t('chat.errorReply', userProfile?.language),
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

      const lang = userProfile?.language;
      let statusMessage: ChatMessage;
      if (updates.answerScope) {
        statusMessage = {
          sender: 'bot',
          text: t(newScope === 'document' ? 'chat.scopeChange.document' : 'chat.scopeChange.general', lang),
          type: 'scope_change',
          variant: newScope === 'document' ? 'document' : 'general',
        };
      } else {
        statusMessage = {
          sender: 'bot',
          text: t(newMode ? 'chat.monkeyMode.on' : 'chat.monkeyMode.off', lang),
          type: 'monkey_mode_status',
          variant: newMode ? 'on' : 'off',
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
    [dispatch, userProfile?.language]
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
