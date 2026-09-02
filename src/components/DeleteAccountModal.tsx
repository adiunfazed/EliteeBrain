import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, X, Download } from 'lucide-react';
import { getIdToken, logoutUser } from '../lib/firebase';
import { UserProfile } from '../types';

interface Props {
  profile: UserProfile;
  onClose: () => void;
}

/**
 * Account deletion.
 *
 * Deliberately effortful: this is irreversible, so it asks for a typed
 * confirmation rather than a single tap. It also offers an export first,
 * because "let me leave" and "destroy my data" are different intentions and
 * conflating them loses people's work.
 */
export const DeleteAccountModal: React.FC<Props> = ({ profile, onClose }) => {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = typed.trim().toUpperCase() === 'DELETE' && !busy;

  const exportData = () => {
    // Everything the app holds locally, in a readable format. No server round
    // trip, so it works even if deletion later fails.
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elitelife-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = async () => {
    if (!canDelete) return;
    setBusy(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (!token) {
        setError('Please sign in again, then retry.');
        setBusy(false);
        return;
      }

      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || 'Could not delete the account. Please try again.');
        setBusy(false);
        return;
      }

      // Clear local traces too — the server has removed the cloud copy, but
      // this device still holds a cached profile.
      try {
        localStorage.clear();
      } catch {
        /* private mode */
      }

      await logoutUser().catch(() => {});
      window.location.reload();
    } catch {
      setError('Network problem. Your account has not been deleted.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md panel my-8"
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
            style={{ background: 'color-mix(in oklab, var(--danger) 18%, transparent)' }}
          >
            <AlertTriangle className="w-5 h-5 shrink-0 eb-danger" />
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--ink-dim)] shrink-0 ml-auto"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>

        <h2 className="t-title mt-4">Delete your account</h2>

        <p className="t-body text-[#96A0B0] mt-3 leading-relaxed">
          This permanently removes your account and everything in it — tasks, habits, goals,
          routines, sleep logs, focus history, coach conversations and your leaderboard entry.
        </p>

        <p className="t-sub mt-3 leading-relaxed">
          It cannot be undone, and Pro access is not refunded automatically. If you only want to
          stop using the app, signing out is enough.
        </p>

        <button onClick={exportData} className="btn-quiet w-full mt-5">
          <Download className="w-4 h-4 shrink-0" />
          Download my data first
        </button>

        <div className="mt-6">
          <label htmlFor="confirm-delete" className="eb-label block">
            Type DELETE to confirm
          </label>
          <input
            id="confirm-delete"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            autoCapitalize="characters"
            className="w-full mt-2 bg-[var(--surface-sunk)] border border-[var(--rule)] focus:border-[var(--danger)] rounded-xl px-4 py-3 text-[15px] text-[var(--ink)] placeholder:text-[#5A6472] outline-none transition-colors"
          />
        </div>

        {error && (
          <p className="t-sub eb-danger mt-3" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2.5 mt-6">
          <button onClick={onClose} className="btn-quiet flex-1">
            Keep my account
          </button>
          <button
            onClick={remove}
            disabled={!canDelete}
            className="flex-1 min-h-[48px] rounded-xl font-semibold text-white transition-opacity disabled:opacity-35"
            style={{ background: 'var(--danger)' }}
          >
            {busy ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
