export type ProRequestReason = 'documents' | 'ai_actions' | 'generic';

export const PRO_REQUEST_EMAIL = 'support@clevermonkey.app';

const REASON_LABEL: Record<ProRequestReason, string> = {
    documents: '문서 업로드 한도',
    ai_actions: 'AI 사용량 한도',
    generic: 'Pro 전환',
};

export function buildProRequestMailto(params: {
    reason?: ProRequestReason;
    userEmail?: string | null;
} = {}): string {
    const reason = params.reason ?? 'generic';
    const subject = `[Clever Monkey] ${REASON_LABEL[reason]} 요청`;
    const body = [
        '안녕하세요, Clever Monkey Pro 전환을 요청합니다.',
        '',
        `요청 사유: ${REASON_LABEL[reason]}`,
        `계정 이메일: ${params.userEmail || '(여기에 가입 이메일을 입력해 주세요)'}`,
        '',
        '확인 후 Pro 전환 안내를 부탁드립니다.',
    ].join('\n');

    return `mailto:${PRO_REQUEST_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openProRequestEmail(params: {
    reason?: ProRequestReason;
    userEmail?: string | null;
} = {}): void {
    window.location.href = buildProRequestMailto(params);
}
