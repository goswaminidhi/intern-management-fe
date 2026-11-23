import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { chatApi } from '../api/chatApi';
import useAuth from '../hooks/useAuth';
import useChatSocket from '../hooks/useChatSocket';
import ChatWindow from '../components/chat/chatWindow';
import MembersPanel from '../components/chat/membersPanel';
import CreateGroupModal from '../components/chat/createGroupModal';
import ConfirmModal from '../components/common/ConfirmModal';
import ThemeToggle from '../components/ThemeToggle';
import { socket } from '../lib/socket';
import '../components/chat/chat.css';

function formatTimestamp(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function ChatPage() {
  const { user: me } = useAuth();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const notificationGroupId = searchParams.get('groupId');
  const handledNotificationGroupRef = useRef(null);

  const [groups, setGroups] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState({});
  const [hasMore, setHasMore] = useState({});
  const [typing, setTyping] = useState({});
  const [showMembers, setShowMembers] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const activeIdRef = useRef(null);
  const showAllRef = useRef(false);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    showAllRef.current = showAll;
  }, [showAll]);

  const typingTimers = useRef({});
  const loadedRef = useRef(new Set());

  const isManager = me.role === 'admin' || me.role === 'mentor';

  const loadGroups = useCallback(async () => {
    const list = await chatApi.listGroups(showAllRef.current);
    setGroups(list);
    setActiveId((a) => {
      if (a && !list.some((g) => g.id === a)) {
        setShowMembers(false);
        return null;
      }
      return a;
    });
  }, []);

  const markReadUpTo = useCallback((groupId, list) => {
    const last = list[list.length - 1];
    if (!last) return;
    chatApi
      .markRead(groupId, last.id)
      .then(() =>
        setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g)))
      )
      .catch(() => { });
  }, []);

  const loadMessages = useCallback(
    async (groupId) => {
      const res = await chatApi.getMessages(groupId);
      loadedRef.current.add(groupId);
      setMessages((m) => ({ ...m, [groupId]: res.messages }));
      setHasMore((h) => ({ ...h, [groupId]: res.hasMore }));
      markReadUpTo(groupId, res.messages);
    },
    [markReadUpTo]
  );

  useEffect(() => {
    loadGroups().catch(() => { });
  }, [loadGroups, showAll]);

  // ---------- Live events ----------
  const { emitTyping } = useChatSocket({
    onMessage: (m) => {
      setMessages((prev) => {
        const list = prev[m.groupId];
        if (!list || list.some((x) => x.id === m.id)) return prev;
        return { ...prev, [m.groupId]: [...list, m] };
      });

      const isActive = activeIdRef.current === m.groupId;
      const mine = m.senderId === me.id;
      setGroups((gs) => {
        if (!gs.some((g) => g.id === m.groupId)) return gs;
        return gs.map((g) =>
          g.id === m.groupId
            ? {
              ...g,
              lastMessage: m,
              lastActivityAt: m.createdAt,
              unreadCount:
                isActive || mine || m.type === 'system'
                  ? g.unreadCount
                  : (g.unreadCount ?? 0) + 1,
            }
            : g
        );
      });
      if (isActive && !mine) chatApi.markRead(m.groupId, m.id).catch(() => { });
    },

    onMessageDeleted: ({ groupId, messageId }) => {
      setMessages((prev) => {
        const list = prev[groupId];
        if (!list) return prev;
        return {
          ...prev,
          [groupId]: list.map((x) =>
            x.id === messageId ? { ...x, deleted: true, body: null, attachments: [] } : x
          ),
        };
      });

      setGroups((gs) =>
        gs.map((g) =>
          g.id === groupId && g.lastMessage?.id === messageId
            ? { ...g, lastMessage: { ...g.lastMessage, deleted: true, body: null, attachments: [] } }
            : g
        )
      );
    },

    onGroupChanged: () => {
      loadGroups().catch(() => { });
    },

    onTyping: ({ groupId, userId, name }) => {
      if (userId === me.id) return;
      setTyping((t) => ({ ...t, [groupId]: name }));
      window.clearTimeout(typingTimers.current[groupId]);
      typingTimers.current[groupId] = window.setTimeout(
        () =>
          setTyping((t) => {
            const copy = { ...t };
            delete copy[groupId];
            return copy;
          }),
        3000
      );
    },

    onReconnect: () => {
      loadGroups().catch(() => { });
      const id = activeIdRef.current;
      if (id) loadMessages(id).catch(() => { });
    },
  });

  // ---------- Actions ----------
  const openGroup = useCallback((g) => {
    setActiveId(g.id);

    // Tell the backend that this user is viewing this group
    socket.emit('chat:active', {
      groupId: g.id,
    });

    if (loadedRef.current.has(g.id)) {
      if (g.myRole !== null) {
        markReadUpTo(g.id, messages[g.id] ?? []);
      }
    } else {
      loadMessages(g.id).catch((err) => {
        console.error('Failed to load messages:', err);
      });
    }
  }, [loadMessages, markReadUpTo, messages]);

  // Open the group from a notification link (?groupId=...)
  useEffect(() => {
    if (!notificationGroupId || groups.length === 0) return;
    if (handledNotificationGroupRef.current === notificationGroupId) return;

    const group = groups.find(
      (g) => Number(g.id) === Number(notificationGroupId)
    );

    if (!group) {
      console.error('Group not found!');
      return;
    }

    handledNotificationGroupRef.current = notificationGroupId;
    setTimeout(() => {
      openGroup(group);
    }, 0);
  }, [notificationGroupId, groups, openGroup]);

  useEffect(() => {
    return () => {
      socket.emit('chat:inactive');
    };
  }, []);

  const loadOlder = async () => {
    if (!activeId) return;
    const list = messages[activeId] ?? [];
    if (!list.length) return;
    const res = await chatApi.getMessages(activeId, list[0].id);
    setMessages((m) => ({ ...m, [activeId]: [...res.messages, ...(m[activeId] ?? [])] }));
    setHasMore((h) => ({ ...h, [activeId]: res.hasMore }));
  };

  const send = async (body, files) => {
    if (!activeId) return;
    const msg = await chatApi.sendMessage(activeId, body, files);
    setMessages((prev) => {
      const list = prev[activeId] ?? [];
      return list.some((x) => x.id === msg.id) ? prev : { ...prev, [activeId]: [...list, msg] };
    });
  };

  const [messageToDelete, setMessageToDelete] = useState(null);
  const [deleteMsgLoading, setDeleteMsgLoading] = useState(false);

  const remove = (messageId) => {
    if (!activeId) return;
    setMessageToDelete(messageId);
  };

  const confirmDeleteMessage = async () => {
    if (!activeId || !messageToDelete) return;
    setDeleteMsgLoading(true);
    try {
      await chatApi.deleteMessage(activeId, messageToDelete);
      setMessageToDelete(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteMsgLoading(false);
    }
  };

  const active = groups.find((g) => g.id === activeId) ?? null;

  // Filter groups in sidebar
  const filteredGroups = useMemo(() => {
    if (!searchFilter.trim()) return groups;
    const q = searchFilter.toLowerCase();
    return groups.filter((g) => g.name?.toLowerCase().includes(q));
  }, [groups, searchFilter]);

  return (
    <div className="h-screen h-[100dvh] max-h-screen bg-slate-100 dark:bg-slate-900 p-2 sm:p-4 flex flex-col gap-2 sm:gap-2.5 font-sans overflow-hidden">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800 px-3 sm:px-5 py-2 sm:py-2.5 rounded-2xl shadow-xs border border-slate-200/90 dark:border-slate-700/80 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-600 shadow-2xs flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden xs:inline sm:inline">Dashboard</span>
          </button>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
          <h1 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 truncate">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="truncate">Team Messaging</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Signed in as</span>
            <strong className="text-slate-800 dark:text-slate-200">{me.name || 'User'}</strong>
            <span className="capitalize px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
              {me.role}
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Chat Layout */}
      <div className="flex-1 flex overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800 shadow-sm relative">
        {/* Sidebar */}
        <aside className={`w-full md:w-80 flex flex-col border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] flex-shrink-0 ${active ? 'hidden md:flex' : 'flex'}`}>
          {/* Sidebar Top: Title & New Group */}
          <div className="p-3.5 pb-2 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Conversations</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                  {groups.length}
                </span>
              </div>
              {isManager && (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <span className="text-sm leading-none font-bold">+</span>
                  <span>New Group</span>
                </button>
              )}
            </div>

            {/* Search Input Filter */}
            <div className="relative">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search groups…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Admin Manage Toggle */}
            {me.role === 'admin' && (
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => setShowAll(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-indigo-600 accent-indigo-600 focus:ring-indigo-500/20"
                />
                <span>Show all groups (admin management)</span>
              </label>
            )}
          </div>

          {/* Group List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredGroups.map((g) => {
              const isSelected = g.id === activeId;
              return (
                <div
                  key={g.id}
                  onClick={() => openGroup(g)}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-3 text-left relative ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {/* Group Avatar */}
                  <div
                    className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-2xs ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-100/60 dark:border-slate-700'
                    }`}
                  >
                    #
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className={`text-xs font-bold truncate ${
                          isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {g.name}
                      </span>

                      {g.lastActivityAt && (
                        <span
                          className={`text-[10px] flex-shrink-0 ${
                            isSelected ? 'text-white/75' : 'text-slate-400 dark:text-slate-400'
                          }`}
                        >
                          {formatTimestamp(g.lastActivityAt)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-[11px] truncate flex-1 ${
                          isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {g.lastMessage ? (
                          g.lastMessage.deleted ? (
                            <span className="italic">Message deleted</span>
                          ) : (
                            g.lastMessage.body || '📎 Attachment'
                          )
                        ) : g.myRole === null ? (
                          `${g.memberCount ?? 0} members · not a member`
                        ) : (
                          'No messages yet'
                        )}
                      </p>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {g.status === 'archived' && (
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Archived
                          </span>
                        )}

                        {!!g.unreadCount && (
                          <span className="bg-amber-500 text-slate-900 text-[10px] font-black rounded-full px-1.5 py-0.2 shadow-2xs">
                            {g.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredGroups.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500 px-4">
                {searchFilter ? 'No groups found matching your search.' : 'You are not in any chat group yet.'}
              </div>
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className={`flex-1 flex flex-col min-w-0 bg-slate-50/60 dark:bg-slate-900/50 relative ${!active ? 'hidden md:flex' : 'flex'}`}>
          {active ? (
            <ChatWindow
              group={active}
              me={me}
              messages={messages[active.id] ?? []}
              hasMore={!!hasMore[active.id]}
              typingName={typing[active.id]}
              onLoadOlder={loadOlder}
              onSend={send}
              onDelete={remove}
              onTyping={() => emitTyping(active.id)}
              onToggleMembers={() => setShowMembers((s) => !s)}
              onBack={() => setActiveId(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-xs">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Select a Conversation</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                Choose a channel or team from the sidebar to start collaborating, share files, and discuss tasks.
              </p>
            </div>
          )}
        </main>

        {/* Members / Group Info Drawer */}
        {active && showMembers && (
          <>
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden"
              onClick={() => setShowMembers(false)}
            />
            <MembersPanel
              groupId={active.id}
              me={me}
              onClose={() => setShowMembers(false)}
              onChanged={() => loadGroups().catch(() => { })}
              onDeleted={() => {
                setShowMembers(false);
                setActiveId(null);
                loadGroups().catch(() => { });
              }}
            />
          </>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreate && (
        <CreateGroupModal
          meId={me.id}
          onClose={() => setShowCreate(false)}
          onCreated={async (id) => {
            setShowCreate(false);
            await loadGroups();
            setActiveId(id);
            loadMessages(id).catch(() => { });
          }}
        />
      )}

      {/* Delete Message Confirm Modal */}
      <ConfirmModal
        isOpen={!!messageToDelete}
        variant="danger"
        title="Delete Message"
        message="Are you sure you want to delete this message for everyone in this group? This action cannot be undone."
        confirmText="Delete Message"
        loading={deleteMsgLoading}
        onConfirm={confirmDeleteMessage}
        onClose={() => setMessageToDelete(null)}
      />
    </div>
  );
}
