import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, User, Sun, Moon, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, updateProfileData, theme, toggleTheme } = useAuth();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [studentId, setStudentId] = useState(userProfile?.studentId || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen || !userProfile) return null;

  const isStudent = userProfile.role === 'student';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await updateProfileData({
        displayName: displayName.trim(),
        studentId: isStudent ? studentId.trim() : undefined,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6 text-zinc-200">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-zinc-400" />
            <h2 className="text-base font-mono font-semibold text-zinc-100 uppercase tracking-wide">
              Account Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1 rounded hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-zinc-400 uppercase tracking-wider mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div>
            <label className="block text-zinc-400 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="text"
              value={userProfile.email}
              disabled
              className="w-full bg-zinc-950/50 border border-zinc-800/60 rounded px-3 py-2 text-zinc-400 cursor-not-allowed"
            />
          </div>

          {isStudent && (
            <div>
              <label className="block text-zinc-400 uppercase tracking-wider mb-1">
                Student ID
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
                placeholder="e.g. STU-1001"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
            </div>
          )}

          <div>
            <label className="block text-zinc-400 uppercase tracking-wider mb-1">
              Role & Status
            </label>
            <div className="bg-zinc-950 border border-zinc-800 rounded p-2.5 flex items-center justify-between">
              <span className="uppercase text-zinc-300 font-bold">{userProfile.role}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] ${
                  userProfile.approved
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                {userProfile.approved ? 'Active & Approved' : 'Pending Teacher Approval'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-zinc-300 font-medium block">Appearance Theme</span>
                <span className="text-zinc-400 text-[10px]">
                  Current mode: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1.5"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                Toggle
              </button>
            </div>
          </div>

          {savedSuccess && (
            <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 p-2 rounded flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              Settings updated successfully.
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded bg-sky-900/80 hover:bg-sky-800 text-sky-100 font-medium border border-sky-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
