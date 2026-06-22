import { describe, expect, it } from 'vitest';
import { buildProRequestMailto, PRO_REQUEST_EMAIL } from '../../services/proRequest';

describe('pro request mailto', () => {
    it('builds a Pro request mailto with reason and account email', () => {
        const href = buildProRequestMailto({
            reason: 'ai_actions',
            userEmail: 'student@example.com',
        });

        expect(href.startsWith(`mailto:${PRO_REQUEST_EMAIL}?`)).toBe(true);
        expect(decodeURIComponent(href)).toContain('[Clever Monkey] AI 사용량 한도 요청');
        expect(decodeURIComponent(href)).toContain('계정 이메일: student@example.com');
    });

    it('uses a clear placeholder when the account email is unknown', () => {
        const href = decodeURIComponent(buildProRequestMailto({ reason: 'documents' }));

        expect(href).toContain('요청 사유: 문서 업로드 한도');
        expect(href).toContain('계정 이메일: (여기에 가입 이메일을 입력해 주세요)');
    });

});
