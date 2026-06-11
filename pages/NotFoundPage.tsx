import * as React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';
import { useUser } from '../contexts/UserContext';
import { t } from '../services/uiStrings';
import { CleverMonkeyIcon } from '../components/icons';

/**
 * Friendly 404 — replaces the previous silent redirect (App.tsx routed
 * every unknown path back to StudyPage, which left typoed URLs looking
 * like an empty workspace). Keeps the monkey persona warm rather than
 * apologetic, and gives one clear way back.
 */
export const NotFoundPage: React.FC = () => {
    const { userProfile } = useUser();
    const language = userProfile?.language;

    return (
        <div className="flex-1 flex items-center justify-center bg-ink-50 px-6 py-10">
            <div className="max-w-md w-full text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-100 mb-6">
                    <CleverMonkeyIcon className="text-5xl text-brand-600" />
                </div>
                <h1 className="text-2xl font-bold text-ink-900 mb-3">
                    {t('notFound.title', language)}
                </h1>
                <p className="text-base text-ink-600 mb-8 leading-relaxed">
                    {t('notFound.subtitle', language)}
                </p>
                <Link
                    to={ROUTES.STUDY}
                    className="inline-flex items-center justify-center px-6 py-3 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 active:scale-[0.98] text-white rounded-xl font-semibold transition-all shadow-brand"
                >
                    {t('notFound.cta', language)}
                </Link>
            </div>
        </div>
    );
};
