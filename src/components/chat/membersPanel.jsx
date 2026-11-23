import { useCallback, useEffect, useState } from 'react';
import { chatApi } from '../../api/chatApi';
import ConfirmModal from '../common/ConfirmModal';

function getInitials(name = '') {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-600 text-white',
  'bg-indigo-600 text-white',
  'bg-purple-600 text-white',
  'bg-emerald-600 text-white',
  'bg-amber-600 text-white',
  'bg-rose-600 text-white',
  'bg-teal-600 text-white',
  'bg-cyan-600 text-white',
];

function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

/** Props: groupId, me {id, role}, onClose(), onChanged(), onDeleted() */
export default function MembersPanel({ groupId, me, onClose, onChanged, onDeleted }) {
  const [group, setGroup] = useState(null);
  const [users, setUsers] = useState([]);
  const [toAdd, setToAdd] = useState('');
  const [error, setError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await chatApi.getGroup(groupId);
      setGroup(data);
      setNewName(data.name);
    } catch {
      setError('Could not load group details');
    }
  }, [groupId]);

  useEffect(() => {
    let isMounted = true;
    chatApi
      .getGroup(groupId)
      .then((data) => {
        if (isMounted) {
          setGroup(data);
          setNewName(data.name);
        }
      })
      .catch(() => {
        if (isMounted) setError('Could not load group details');
      });
    return () => {
      isMounted = false;
    };
  }, [groupId]);

  const canManage =
    !!group && group.status === 'active' && (me.role === 'admin' || group.myRole === 'owner');

  useEffect(() => {
    if (canManage) chatApi.listUsers().then(setUsers).catch(() => { });
  }, [canManage]);

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Action failed');
    }
  };

  const handleRename = async (e) => {
    e?.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || trimmed === group.name) {
      setIsEditingName(false);
      return;
    }
    await run(async () => {
      await chatApi.renameGroup(groupId, trimmed);
      setIsEditingName(false);
    });
  };

  const confirmDeleteGroup = async () => {
    setActionInProgress(true);
    setError('');
    try {
      await chatApi.deleteGroup(groupId);
      setShowDeleteConfirm(false);
      if (onDeleted) {
        onDeleted(groupId);
      } else {
        onClose?.();
        onChanged?.();
      }
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to delete group');
    } finally {
      setActionInProgress(false);
    }
  };

  const confirmArchiveGroup = async () => {
    setActionInProgress(true);
    try {
      await chatApi.archiveGroup(groupId);
      setShowArchiveConfirm(false);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to archive group');
    } finally {
      setActionInProgress(false);
    }
  };

  if (!group) {
    return (
      <aside className="w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-xs">{error || 'Loading details…'}</span>
      </aside>
    );
  }

  const memberIds = new Set(group.members.map((m) => m.userId));
  const candidates = users.filter((u) => !memberIds.has(u.id));

  const filteredMembers = group.members.filter(
    (m) =>
      m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 md:static md:w-80 lg:w-96 border-l border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col h-full shadow-2xl md:shadow-lg flex-shrink-0 animate-fadeIn">
      {/* Panel Top Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Group Information
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Group Hero Card */}
        <div className="text-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-md mb-3">
            #
          </div>

          {/* Group Name / Edit */}
          {isEditingName ? (
            <form onSubmit={handleRename} className="space-y-2 mt-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={120}
                className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg border border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-center"
                autoFocus
              />
              <div className="flex justify-center gap-2">
                <button
                  type="submit"
                  className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(false);
                    setNewName(group.name);
                  }}
                  className="px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {group.name}
              </h2>
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(true);
                    setNewName(group.name);
                  }}
                  title="Rename group"
                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Group Status */}
          <div className="mt-2 flex items-center justify-center gap-2">
            {group.status === 'archived' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Archived & Read-only
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active Channel
              </span>
            )}
          </div>

          {group.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 px-2 text-center line-clamp-3">
              {group.description}
            </p>
          )}

          {group.myRole === null && me.role === 'admin' && (
            <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 text-[11px] font-medium">
              Administrator View (Monitoring access)
            </div>
          )}
        </div>

        {/* Members Section */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Members ({group.members.length})
            </h4>
          </div>

          {group.members.length > 5 && (
            <div className="mb-2.5">
              <input
                type="text"
                placeholder="Search members…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          )}

          <ul className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
            {filteredMembers.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-3 pt-1.5 first:pt-0 group/mem"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs ${getAvatarColor(
                      m.name
                    )}`}
                  >
                    {getInitials(m.name)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {m.name}
                      </p>
                      {m.role === 'owner' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60">
                          Owner
                        </span>
                      )}
                      {m.userId === me.id && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          (You)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {m.email}
                    </p>
                  </div>
                </div>

                {canManage && m.userId !== me.id && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Remove ${m.name} from this group?`)) {
                        run(() => chatApi.removeMember(groupId, m.userId));
                      }
                    }}
                    title={`Remove ${m.name}`}
                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer flex-shrink-0 opacity-0 group-hover/mem:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Add Member Card */}
        {canManage && candidates.length > 0 && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Add New Member
            </label>
            <div className="flex gap-2">
              <select
                value={toAdd}
                onChange={(e) => setToAdd(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Select user…</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!toAdd}
                onClick={() =>
                  run(async () => {
                    await chatApi.addMembers(groupId, [Number(toAdd)]);
                    setToAdd('');
                  })
                }
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Management & Danger Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {/* Archive Action (Allowed for active groups by manager) */}
          {canManage && group.status === 'active' && (
            <button
              type="button"
              onClick={() => setShowArchiveConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/60 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Archive Group
            </button>
          )}

          {/* Delete Action: Admins can delete groups at any time, even if not archived */}
          {me.role === 'admin' && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Group Permanently
            </button>
          )}
        </div>

        {/* Confirmation Modals */}
        <ConfirmModal
          isOpen={showArchiveConfirm}
          variant="warning"
          title="Archive Chat Group"
          message={`Are you sure you want to archive "${group.name}"? It will become read-only for all members.`}
          confirmText="Archive Group"
          loading={actionInProgress}
          onConfirm={confirmArchiveGroup}
          onClose={() => setShowArchiveConfirm(false)}
        />

        <ConfirmModal
          isOpen={showDeleteConfirm}
          variant="danger"
          title="Delete Group Permanently"
          message={`Are you sure you want to permanently delete "${group.name}"? All messages, discussions, and attachments will be deleted forever.`}
          confirmText="Delete Group"
          loading={actionInProgress}
          onConfirm={confirmDeleteGroup}
          onClose={() => setShowDeleteConfirm(false)}
        />

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}
      </div>
    </aside>
  );
}
