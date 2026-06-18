import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiJobProvider, aiJobBusyMessage, useAiJobGate } from '../../contexts/AiJobContext';

const Probe: React.FC = () => {
  const gate = useAiJobGate();
  const [finish, setFinish] = React.useState<(() => void) | null>(null);
  const [blockedMessage, setBlockedMessage] = React.useState('');

  const startPodcast = () => {
    const lease = gate.tryStartJob({
      kind: 'podcast_script',
      documentId: 'doc-1',
      label: '팟캐스트 스크립트 생성',
    });
    if (lease.ok) {
      setBlockedMessage('');
      setFinish(() => lease.finish);
    }
  };

  const startQuiz = () => {
    const lease = gate.tryStartJob({
      kind: 'quiz',
      documentId: 'doc-1',
      label: '퀴즈 생성',
    });
    if (lease.ok === false) {
      setBlockedMessage(aiJobBusyMessage(lease.activeJob));
      return;
    }
    setBlockedMessage('');
    setFinish(() => lease.finish);
  };

  return (
    <div>
      <p data-testid="active-job">{gate.activeJob?.label ?? 'none'}</p>
      <p data-testid="blocked-message">{blockedMessage}</p>
      <button type="button" onClick={startPodcast}>start podcast</button>
      <button type="button" onClick={startQuiz}>start quiz</button>
      <button type="button" onClick={() => finish?.()}>finish</button>
    </div>
  );
};

describe('AiJobProvider', () => {
  it('allows one heavy AI job at a time and releases the slot on finish', () => {
    render(
      <AiJobProvider>
        <Probe />
      </AiJobProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'start podcast' }));
    expect(screen.getByTestId('active-job')).toHaveTextContent('팟캐스트 스크립트 생성');

    fireEvent.click(screen.getByRole('button', { name: 'start quiz' }));
    expect(screen.getByTestId('active-job')).toHaveTextContent('팟캐스트 스크립트 생성');
    expect(screen.getByTestId('blocked-message')).toHaveTextContent('지금 팟캐스트 스크립트 생성 중');

    fireEvent.click(screen.getByRole('button', { name: 'finish' }));
    expect(screen.getByTestId('active-job')).toHaveTextContent('none');

    fireEvent.click(screen.getByRole('button', { name: 'start quiz' }));
    expect(screen.getByTestId('active-job')).toHaveTextContent('퀴즈 생성');
  });
});
