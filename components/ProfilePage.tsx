import * as React from 'react';
import { ChevronLeftIcon, CheckIcon, CleverMonkeyIcon } from './icons';

interface ProfilePageProps {
  userEmail: string | null;
  fileCount: number;
  storageUsage: string;
  planName: string;
  onBack: () => void;
  onUpgrade: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  userEmail,
  fileCount,
  storageUsage,
  planName,
  onBack,
  onUpgrade,
}) => {
  const displayName = userEmail?.split('@')[0] || 'Guest';

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-semibold"
            aria-label="Back to workspace"
          >
            <ChevronLeftIcon className="text-xl" />
            Back
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold text-slate-900 font-outfit">Profile</h1>
          </div>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
              <CleverMonkeyIcon className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
              <p className="text-sm text-slate-500">{userEmail || 'Not signed in'}</p>
            </div>
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider">
              {planName}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Documents</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-2">{fileCount}</h3>
            <p className="text-sm text-slate-500 mt-1">Uploaded files</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Storage</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-2">{storageUsage}</h3>
            <p className="text-sm text-slate-500 mt-1">Used capacity</p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 text-white p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="relative">
            <h3 className="text-2xl font-bold font-outfit">Unlock Pro Features</h3>
            <p className="text-sm text-slate-300 mt-2">Upgrade to get higher limits, advanced analytics, and premium AI models.</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              {['Higher upload limits', 'Priority processing', 'Team sharing'].map(item => (
                <li key={item} className="flex items-center gap-2">
                  <CheckIcon className="text-lg text-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={onUpgrade}
              className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] transition-transform"
            >
              Upgrade Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
