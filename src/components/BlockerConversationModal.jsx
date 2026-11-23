import { useEffect, useRef } from "react";

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Shared chat modal for task blockers.
 * "Mark as Resolved" is shown ONLY when the parent passes `onResolve`
 * AND the logged-in user is the mentee who raised the blocker.
 */
const BlockerConversationModal = ({
  conversation,
  loading,
  error,
  currentUserId,
  chatInput,
  onChatInputChange,
  onSend,
  sending,
  onResolve,
  resolving,
  onClose,
}) => {
  const bottomRef = useRef(null);
  const messages = conversation?.messages ?? [];
  const isOpen = conversation?.status === "open";
  const canResolve =
    typeof onResolve === "function" &&
    isOpen &&
    Number(conversation?.menteeId) === Number(currentUserId);

  // Scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Close with Escape
  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Task Blocker</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {conversation?.task?.title || "Loading task..."}
            </p>
            {conversation && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                {conversation.mentee?.name} &harr; {conversation.mentor?.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {conversation && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  isOpen
                    ? "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30"
                    : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                }`}
              >
                {isOpen ? "Open" : "Resolved"}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-xl leading-none text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-[220px]">
          {loading && !conversation && (
            <p className="text-xs text-slate-400 italic">Loading conversation...</p>
          )}

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          {conversation && messages.length === 0 && !loading && (
            <p className="text-xs text-slate-400 italic text-center py-6">No messages yet.</p>
          )}

          {messages.map((m) => {
            const mine = Number(m.senderId) === Number(currentUserId);
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm"
                  }`}
                >
                  <p className={`text-[10px] font-bold mb-0.5 ${mine ? "text-indigo-100" : "text-slate-500 dark:text-slate-300"}`}>
                    {mine ? "You" : m.sender?.name || "User"}
                    {m.sender?.role ? ` (${m.sender.role})` : ""}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  <p className={`text-[10px] mt-1 text-right ${mine ? "text-indigo-200" : "text-slate-400"}`}>
                    {formatTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
          {conversation && isOpen ? (
            <form
              onSubmit={onSend}
              className="flex items-end gap-2"
            >
              <textarea
                rows={2}
                maxLength={2000}
                value={chatInput}
                onChange={(e) => onChatInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder="Type a message... (Enter to send)"
                className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || sending}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </form>
          ) : conversation ? (
            <p className="text-xs text-center text-emerald-600 dark:text-emerald-300 font-semibold">
              This blocker has been resolved. The conversation is read-only.
            </p>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-2">
            {canResolve ? (
              <button
                type="button"
                onClick={onResolve}
                disabled={resolving}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {resolving ? "Resolving..." : "Mark as Resolved"}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockerConversationModal;