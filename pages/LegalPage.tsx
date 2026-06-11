import * as React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';
import { useUser } from '../contexts/UserContext';
import { resolveContentLanguage } from '../services/languageService';
import { t } from '../services/uiStrings';
import { ChevronLeftIcon } from '../components/icons';

// First-pass legal pages. Plain-language summaries of how the service
// handles data — written to be a useful baseline for users TODAY, with
// the understanding that a formal review by counsel will replace this
// before paid launch. The PLACEHOLDER_NOTICE makes the provisional
// status explicit so users aren't misled.
//
// Coverage strategy: ship Korean + English bodies; other UI languages
// reuse the English body until localized counsel review. The page
// chrome (header, back button, section titles) is still i18n'd from
// uiStrings so the navigation feels native in every supported language.

interface Body {
    placeholder: string;
    privacyTitle: string;
    privacySections: { heading: string; body: string }[];
    termsTitle: string;
    termsSections: { heading: string; body: string }[];
}

const BODIES: Record<'ko' | 'en', Body> = {
    ko: {
        placeholder: '※ 본 문서는 변호사 검토 전의 임시 안내문입니다. 정식 검토본은 출시 전에 갱신됩니다.',
        privacyTitle: '개인정보 처리방침',
        privacySections: [
            {
                heading: '1. 수집하는 정보',
                body: '계정 정보(이메일, 표시 이름), 업로드한 학습 자료(PDF·이미지·텍스트), 학습 활동(퀴즈 응답·플래시카드 진행 상황·채팅 기록), 그리고 서비스 운영에 필요한 기술 로그(접속 IP·브라우저 정보)를 수집합니다.',
            },
            {
                heading: '2. 이용 목적',
                body: '업로드한 자료를 바탕으로 요약·퀴즈·마인드맵·팟캐스트 등 학습 콘텐츠를 생성하고, 본인 계정의 학습 진척을 유지하며, 부정 사용을 방지하는 데에만 사용합니다.',
            },
            {
                heading: '3. 제3자 제공',
                body: 'AI 모델 응답을 위해 업로드 텍스트와 채팅 내용을 모델 제공자(Google Gemini, Groq, Cerebras)에게 전송합니다. 제공자별 정책에 따라 데이터는 모델 학습에 사용되지 않도록 요청합니다. 그 외 마케팅·광고 목적으로 데이터를 공유하지 않습니다.',
            },
            {
                heading: '4. 보관 기간',
                body: '계정이 활성 상태인 동안 보관하며, 계정 삭제 요청 시 7일 이내에 모든 개인 데이터를 영구 삭제합니다.',
            },
            {
                heading: '5. 사용자 권리',
                body: '언제든지 본인 데이터 열람·수정·삭제·반출을 요청할 수 있습니다. 프로필 페이지에서 직접 가능하거나, 아래 연락처로 요청해 주세요.',
            },
            {
                heading: '6. 보안',
                body: '데이터는 Supabase 인프라(HTTPS·암호화 저장)에서 처리됩니다. 관리자 권한은 최소 인원에게만 부여하며, 침해 사고 발생 시 24시간 이내 통지합니다.',
            },
            {
                heading: '7. 연락처',
                body: '문의: support@clevermonkey.app',
            },
        ],
        termsTitle: '이용약관',
        termsSections: [
            {
                heading: '1. 서비스 개요',
                body: '본 서비스는 사용자가 업로드한 학습 자료를 AI가 분석하여 요약·퀴즈·플래시카드·마인드맵·팟캐스트로 변환해주는 학습 도구입니다.',
            },
            {
                heading: '2. 사용자 책임',
                body: '본인이 적법한 권리를 가진 자료만 업로드해 주세요. 저작권 침해 자료, 불법 콘텐츠, 타인의 개인정보가 포함된 자료는 업로드 금지입니다.',
            },
            {
                heading: '3. AI 생성 콘텐츠',
                body: 'AI가 생성한 요약·퀴즈·답변은 오류나 누락이 있을 수 있습니다. 시험·논문·의학·법률 등 정확성이 결정적인 용도에서는 반드시 원본을 확인하세요. 본 서비스는 학습 보조 목적으로만 사용해 주세요.',
            },
            {
                heading: '4. 무료/유료 플랜',
                body: '무료 플랜은 일일 AI 호출 횟수와 문서 업로드 수에 제한이 있습니다. Pro 플랜은 무제한 사용을 제공하며, 가격과 결제 방식은 별도로 안내됩니다.',
            },
            {
                heading: '5. 책임 한정',
                body: '서비스 중단·데이터 손실·AI 응답의 오류로 발생한 손해에 대해, 법이 허용하는 범위 내에서 본 서비스는 책임을 지지 않습니다. 본인 자료는 본인이 별도로 백업해 두시길 권장합니다.',
            },
            {
                heading: '6. 약관 변경',
                body: '약관이 변경될 경우 서비스 내 공지로 알려드리며, 중대한 변경은 최소 7일 전 사전 고지합니다.',
            },
        ],
    },
    en: {
        placeholder: '※ This is a provisional notice pending formal legal review. The reviewed version will replace it before paid launch.',
        privacyTitle: 'Privacy Policy',
        privacySections: [
            {
                heading: '1. Information we collect',
                body: 'Account information (email, display name), the study materials you upload (PDFs, images, text), your study activity (quiz answers, flashcard progress, chat history), and technical logs needed to operate the service (IP address, browser metadata).',
            },
            {
                heading: '2. How we use it',
                body: 'We use uploaded content only to generate summaries, quizzes, mind maps, podcasts and related learning material for your account; to preserve your progress; and to prevent abuse.',
            },
            {
                heading: '3. Third parties',
                body: 'To produce AI responses, we forward your prompts and uploaded text to AI model providers (Google Gemini, Groq, Cerebras). Per each provider\'s policy we request that your data not be used for model training. We do not share data for marketing or advertising.',
            },
            {
                heading: '4. Retention',
                body: 'We retain data while your account is active. On account-deletion request we permanently remove all personal data within 7 days.',
            },
            {
                heading: '5. Your rights',
                body: 'You may access, correct, delete or export your data at any time. Use the profile page directly or contact us at the address below.',
            },
            {
                heading: '6. Security',
                body: 'Data is stored on Supabase infrastructure (HTTPS in transit, encryption at rest). Admin access is limited to a small operations team. We commit to notifying users within 24 hours of any confirmed security incident.',
            },
            {
                heading: '7. Contact',
                body: 'Questions: support@clevermonkey.app',
            },
        ],
        termsTitle: 'Terms of Service',
        termsSections: [
            {
                heading: '1. The service',
                body: 'Clever Monkey is a learning tool that analyzes uploaded study materials using AI and turns them into summaries, quizzes, flashcards, mind maps, and podcasts.',
            },
            {
                heading: '2. Your responsibilities',
                body: 'Only upload content you have the legal right to use. Do not upload copyright-infringing material, illegal content, or material that contains third parties\' personal information.',
            },
            {
                heading: '3. AI-generated content',
                body: 'AI output can be incomplete or wrong. For purposes where accuracy is critical (exams, academic papers, medical, legal), always verify against the source. Use the service as a study aid, not a primary reference.',
            },
            {
                heading: '4. Free and paid plans',
                body: 'The free plan has daily AI-call and upload limits. The Pro plan removes those limits; price and payment method are announced separately.',
            },
            {
                heading: '5. Limitation of liability',
                body: 'To the extent permitted by law, we are not liable for damages from service interruption, data loss, or errors in AI output. We recommend keeping your own backup of important material.',
            },
            {
                heading: '6. Changes',
                body: 'If these terms change we will notify you in-product. Material changes take effect after at least 7 days\' notice.',
            },
        ],
    },
};

interface LegalPageProps { mode: 'privacy' | 'terms' }

export const LegalPage: React.FC<LegalPageProps> = ({ mode }) => {
    const { userProfile } = useUser();
    const language = userProfile?.language;
    // Korean body for Korean speakers, English body for everyone else
    // until counsel-reviewed translations land.
    const bodyLang = resolveContentLanguage(language) === 'ko' ? 'ko' : 'en';
    const body = BODIES[bodyLang];
    const title = mode === 'privacy' ? body.privacyTitle : body.termsTitle;
    const sections = mode === 'privacy' ? body.privacySections : body.termsSections;

    return (
        <div className="flex-1 overflow-y-auto bg-ink-50">
            <div className="max-w-2xl mx-auto px-6 py-10">
                <Link
                    to={ROUTES.STUDY}
                    className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900 mb-6 transition-colors"
                >
                    <ChevronLeftIcon className="text-base" />
                    {t('common.back', language)}
                </Link>
                <h1 className="text-3xl font-bold text-ink-900 mb-2">{title}</h1>
                <p className="text-sm text-ink-500 mb-8 leading-relaxed">{body.placeholder}</p>
                <div className="space-y-6">
                    {sections.map(({ heading, body: text }, i) => (
                        <section key={i}>
                            <h2 className="text-lg font-semibold text-ink-900 mb-2">{heading}</h2>
                            <p className="text-base text-ink-700 leading-relaxed whitespace-pre-line">{text}</p>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
};
