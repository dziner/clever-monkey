import * as React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';
import { useUser } from '../contexts/UserContext';
import { t } from '../services/uiStrings';

/**
 * Trust footer: Privacy / Terms / support link in one quiet row.
 * Surfaces legal documents without weighing down the landing hero.
 */
export const LegalFooter: React.FC = () => {
    const { userProfile } = useUser();
    const language = userProfile?.language;
    return (
        <footer className="border-t border-ink-100 bg-white">
            <div className="max-w-5xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-ink-500">
                <div className="flex items-center gap-1.5">
                    <span className="text-base">🐒</span>
                    <span>Clever Monkey</span>
                </div>
                <nav className="flex items-center gap-5">
                    <Link to={ROUTES.PRIVACY} className="hover:text-ink-900 transition-colors">
                        {t('legal.privacy', language)}
                    </Link>
                    <Link to={ROUTES.TERMS} className="hover:text-ink-900 transition-colors">
                        {t('legal.terms', language)}
                    </Link>
                    <a
                        href="mailto:support@clevermonkey.app"
                        className="hover:text-ink-900 transition-colors"
                    >
                        support@clevermonkey.app
                    </a>
                </nav>
            </div>
        </footer>
    );
};
