import { useEffect, useState } from 'react';
import { chatApi } from '../../api/chatApi';

const formatSize = (n) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export default function AttachmentView({ att }) {
  const isImage = att.mimeType?.startsWith('image/');

  const [src, setSrc] = useState(null);

  const attachmentEndpoint = att.id ? `/chat/attachments/${att.id}` : att.url;

  useEffect(() => {
    if (!isImage || !attachmentEndpoint) return undefined;

    let objectUrl = null;
    let cancelled = false;

    // Fetch decrypted blob through authenticated backend endpoint
    chatApi
      .fetchAttachment(attachmentEndpoint)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch((err) => {
        console.error('Failed to load image preview:', err);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentEndpoint, isImage]);

  const download = async () => {
    try {
      if (!attachmentEndpoint) return;
      const blob = await chatApi.fetchAttachment(attachmentEndpoint);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.originalName || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Failed to download attachment:', err);
      if (att.url) window.open(att.url, '_blank');
    }
  };

  if (isImage) {
    return src ? (
      <div
        className="relative group/img max-w-[280px] sm:max-w-[340px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow-xs mt-2 cursor-pointer bg-slate-900/5 dark:bg-slate-900/50"
        onClick={download}
      >
        <img
          className="w-full max-h-[260px] object-cover transition-transform duration-200 group-hover/img:scale-[1.02]"
          src={src}
          alt={att.originalName}
          title="Click to download"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-semibold backdrop-blur-[2px]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Download</span>
        </div>
      </div>
    ) : (
      <div className="h-28 w-48 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-400 animate-pulse border border-slate-200 dark:border-slate-700 mt-2">
        Loading image…
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={download}
      className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-left transition-all mt-2 max-w-sm w-full group shadow-2xs cursor-pointer"
    >
      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {att.originalName}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {formatSize(att.size)}
        </p>
      </div>
      <div className="p-1.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex-shrink-0">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
    </button>
  );
}