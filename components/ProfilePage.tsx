import * as React from 'react';
import { ChevronLeftIcon, CheckIcon, CleverMonkeyIcon, EditIcon, XIcon } from './icons';
import { updateMyDisplayName } from '../services/profileService';

interface ProfilePageProps {
  userEmail: string | null;
  displayName: string | null;
  fileCount: number;
  storageUsage: string;
  planName: string;
  onBack: () => void;
  onUpgrade: () => void;
  onNameSaved: () => void | Promise<void>;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  userEmail,
  displayName,
  fileCount,
  storageUsage,
  planName,
  onBack,
  onUpgrade,
  onNameSaved,
}) => {
  const fallbackName = userEmail?.split('@')[0] || 'Guest';
  const shownName = displayName?.trim() || fallbackName;

  const [isEditing, setIsEditing] = React.useState(false);
  const [draftName, setDraftName] = React.useState(displayName ?? '');
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const startEdit = () => {
    setDraftName(displayName ?? '');
    setError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setError(null);
  };

  const saveEdit = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) { setError('이름을 입력해 주세요.'); return; }
    if (trimmed === (displayName ?? '').trim()) { setIsEditing(false); return; }
    setIsSaving(true);
    setError(null);
    const ok = await updateMyDisplayName(trimmed);
    setIsSaving(false);
    if (!ok) { setError('저장에 실패했습니다.'); return; }
    await onNameSaved();
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') saveEdit();
    else if (e.key === 'Escape') cancelEdit();
  };

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
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <CleverMonkeyIcon className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="이름"
                    autoFocus
                    maxLength={60}
                    className="flex-1 min-w-0 text-xl font-bold text-slate-900 bg-white border border-blue-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={isSaving || !draftName.trim()}
                    className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-40"
                    aria-label="Save name"
                  >
                    <CheckIcon className="text-lg" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isSaving}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                    aria-label="Cancel"
                  >
                    <XIcon className="text-lg" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 truncate">{shownName}</h2>
                  <button
                    type="button"
                    onClick={startEdit}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    aria-label="Edit name"
                    title="이름 수정"
                  >
                    <EditIcon className="text-base" />
                  </button>
                </div>
              )}
              <p className="text-sm text-slate-500 truncate">{userEmail || 'Not signed in'}</p>
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            </div>
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider flex-shrink-0">
              {planName}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Documents</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-2">{fileCount}</h3>
            <p className="text-sm text-slate-500 mt-1">Uploaded files</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Storage</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-2">{storageUsage}</h3>
            <p className="text-sm text-slate-500 mt-1">Used capacity</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-300 transform rotate-12">
               <CleverMonkeyIcon className="w-24 h-24 text-blue-600" />
            </div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Current Plan</p>
            <h3 className="text-2xl font-bold text-blue-600 mt-2">{planName}</h3>
            <p className="text-sm text-slate-500 mt-1">Personal Tier</p>
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
