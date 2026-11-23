import { useEffect, useRef, useState, useMemo } from 'react';
import AttachmentView from './attachmentView';

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDateLabel(iso) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return '';
  }
}

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

/**
 * Props: group, me {id, role}, messages, hasMore, typingName,
 *        onLoadOlder(), onSend(body, files), onDelete(messageId), onTyping(), onToggleMembers()
 */
export default function ChatWindow({
  group,
  me,
  messages,
  hasMore,
  typingName,
  onLoadOlder,
  onSend,
  onDelete,
  onTyping,
  onToggleMembers,
  onBack,
}) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const lastTypingEmit = useRef(0);
  const fileInput = useRef(null);

  const isArchived = group.status === 'archived';
  const canDelete = (m) =>
    !m.deleted &&
    m.type !== 'system' &&
    !isArchived &&
    (m.senderId === me.id || me.role === 'admin');

  // Group messages by day for date dividers
  const groupedMessages = useMemo(() => {
    const list = [];
    let lastDate = '';

    for (const m of messages) {
      const dateKey = m.createdAt ? new Date(m.createdAt).toDateString() : '';
      if (dateKey && dateKey !== lastDate) {
        list.push({ isDivider: true, dateKey, id: `divider-${dateKey}-${m.id}` });
        lastDate = dateKey;
      }
      list.push(m);
    }
    return list;
  }, [messages]);

  // Scroll to bottom when newest message changes
  const newestId = messages[messages.length - 1]?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [newestId, group.id]);

  const send = async () => {
    if (sending || (!text.trim() && files.length === 0)) return;
    setSending(true);
    setError('');
    try {
      await onSend(text, files);
      setText('');
      setFiles([]);
      if (fileInput.current) fileInput.current.value = '';
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleChange = (value) => {
    setText(value);
    const now = Date.now();
    if (now - lastTypingEmit.current > 2000) {
      lastTypingEmit.current = now;
      onTyping();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-[#0b0f19] relative">
      {/* ========================================================
          CHAT HEADER: CLICKING ON GROUP NAME OPENS GROUP DETAILS
          ======================================================== */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 bg-white dark:bg-[#111827] border-b border-slate-200/80 dark:border-slate-800 shadow-2xs z-10 flex-shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 max-w-[80%]">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
              title="Back to conversations"
              aria-label="Back to conversations"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMembers}
            title="Click to view group details & members"
            className="flex items-center gap-2.5 sm:gap-3 p-1 rounded-xl hover:bg-slate-100/90 dark:hover:bg-slate-700/60 transition-all text-left cursor-pointer group min-w-0"
          >
            {/* Group Avatar */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-bold flex items-center justify-center flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform text-sm tracking-wide">
              #
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {group.name}
                </h2>
                {isArchived ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Archived
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Active group" />
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                <span>{group.memberCount ? `${group.memberCount} members` : 'Group details'}</span>
                <span>·</span>
                <span className="text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-0.5 font-medium">
                  View info
                  <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Right Info Quick Trigger */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMembers}
            title="Group Information"
            aria-label="Group Information"
            className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* ========================================================
          MESSAGES SCROLL AREA
          ======================================================== */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 scroll-smooth">
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={onLoadOlder}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 rounded-full shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
              <span>Load older messages</span>
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-xs">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No messages in this group yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Start the conversation below.</p>
          </div>
        )}

        {groupedMessages.map((item) => {
          if (item.isDivider) {
            return (
              <div key={item.id} className="flex items-center my-4">
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700/80" />
                <span className="px-3 py-0.5 mx-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-full shadow-2xs">
                  {formatDateLabel(item.dateKey)}
                </span>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700/80" />
              </div>
            );
          }

          const m = item;

          if (m.type === 'system') {
            return (
              <div key={m.id} className="flex justify-center my-2">
                <span className="px-3.5 py-1 text-xs text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 rounded-full shadow-2xs inline-flex items-center gap-1.5 backdrop-blur-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {m.body}
                </span>
              </div>
            );
          }

          const isMine = m.senderId === me.id;

          return (
            <div
              key={m.id}
              className={`flex items-end gap-2 group/msg ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              {/* Other Sender Avatar */}
              {!isMine && (
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 shadow-2xs mb-0.5 ${getAvatarColor(
                    m.senderName
                  )}`}
                  title={m.senderName}
                >
                  {getInitials(m.senderName)}
                </div>
              )}

              {/* Message Bubble Container */}
              <div
                className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-xs transition-all ${
                  isMine
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-br-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs'
                }`}
              >
                {/* Header (Sender & Timestamp) */}
                <div className="flex items-center justify-between gap-3 mb-1 text-[11px]">
                  <span
                    className={`font-semibold truncate ${
                      isMine ? 'text-white/90' : 'text-indigo-600 dark:text-indigo-400'
                    }`}
                  >
                    {isMine ? 'You' : m.senderName}
                  </span>

                  <span className={`text-[10px] flex-shrink-0 ${isMine ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                    {formatTime(m.createdAt)}
                  </span>
                </div>

                {/* Message Body */}
                {m.deleted ? (
                  <div className={`flex items-center gap-1.5 text-xs italic ${isMine ? 'text-white/75' : 'text-slate-400 dark:text-slate-500'}`}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>This message was deleted</span>
                  </div>
                ) : (
                  <>
                    {m.body && (
                      <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {m.body}
                      </div>
                    )}
                    {m.attachments?.map((a) => (
                      <AttachmentView key={a.id} att={a} />
                    ))}
                  </>
                )}

                {/* Delete Message Action Trigger on Hover */}
                {canDelete(m) && (
                  <button
                    type="button"
                    onClick={() => onDelete(m.id)}
                    title="Delete message for everyone"
                    className={`absolute -top-2.5 ${
                      isMine ? '-left-2.5' : '-right-2.5'
                    } p-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs opacity-0 group-hover/msg:opacity-100 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Typing Indicator Bar */}
      <div className="h-5 px-6 text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 transition-opacity">
        {typingName ? (
          <>
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
            </span>
            <span>{typingName} is typing…</span>
          </>
        ) : null}
      </div>

      {/* ========================================================
          COMPOSER
          ======================================================== */}
      {isArchived ? (
        <div className="p-4 bg-slate-100 dark:bg-[#111827] border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span>This group is archived and read-only.</span>
        </div>
      ) : (
        <div className="p-3 sm:p-4 bg-white dark:bg-[#111827] border-t border-slate-200/80 dark:border-slate-800 flex-shrink-0">
          {/* Selected File Chips */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2.5">
              {files.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 shadow-2xs"
                >
                  <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="max-w-[140px] truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {error && (
            <div className="mb-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Composer Inputs Row */}
          <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-900/80 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-2xs">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              title="Attach files (up to 5, max 10MB each)"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.docx,.xlsx,.pptx"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
            />

            {/* Message Textarea */}
            <textarea
              value={text}
              rows={1}
              maxLength={2000}
              placeholder="Type your message here... (Enter to send, Shift + Enter for newline)"
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-none outline-none py-1.5 max-h-32 min-h-[36px]"
            />

            {/* Send Button */}
            <button
              type="button"
              onClick={send}
              disabled={sending || (!text.trim() && files.length === 0)}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer flex-shrink-0 flex items-center justify-center"
              title="Send message"
            >
              {sending ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 -rotate-45 -translate-y-0.5 translate-x-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
