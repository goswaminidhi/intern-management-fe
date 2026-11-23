import { useState } from "react";

const LINE = "bg-slate-300 dark:bg-slate-600";

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

const ROLE_STYLES = {
  admin: {
    top: "border-t-rose-500",
    badge: "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300",
    avatar: "bg-rose-600 text-white",
    label: "Admin",
  },
  mentor: {
    top: "border-t-blue-500",
    badge: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300",
    avatar: "bg-blue-600 text-white",
    label: "Mentor",
  },
  mentee: {
    top: "border-t-emerald-500",
    badge: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    avatar: "bg-emerald-600 text-white",
    label: "Mentee",
  },
};

function PersonCard({ user, role, footer, onClick }) {
  const s = ROLE_STYLES[role];
  const inactive = (user.status || "").toLowerCase() === "inactive";

  return (
    <div
      onClick={onClick}
      className={`relative z-10 w-full max-w-[15rem] min-w-[11rem] rounded-xl border border-slate-200/80 dark:border-slate-700/80 border-t-4 ${s.top} bg-white dark:bg-slate-800 shadow-xs p-2 text-center ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
    >
      <div
        className={`mx-auto w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${s.avatar}`}
      >
        {initials(user.name)}
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white truncate">
        {user.name}
      </p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>

     <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${s.badge}`}>
          {s.label}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            inactive
              ? "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
          }`}
        >
          {user.status || "Active"}
        </span>
      </div>

      {footer && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
          {footer}
        </div>
      )}
    </div>
  );
}

export default function HierarchyTree({ admin, mentors, mentees, resolveMenteeMentor }) {
  const [closedIds, setClosedIds] = useState(() => new Set());

  const toggle = (id) =>
    setClosedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Group mentees under their mentor
  const byMentor = {};
  const unassigned = [];
  mentees.forEach((mentee) => {
    const mentor = resolveMenteeMentor(mentee);
    if (mentor) (byMentor[mentor.id] ||= []).push(mentee);
    else unassigned.push(mentee);
  });

  const allClosed = mentors.length > 0 && mentors.every((m) => closedIds.has(m.id));

  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <button
          onClick={() => setClosedIds(allClosed ? new Set() : new Set(mentors.map((m) => m.id)))}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
        >
          {allClosed ? "Expand all" : "Collapse all"}
        </button>
      </div>

      {/* ORG CHART */}
      <div className="pb-6 overflow-x-auto w-full">
        <div className="min-w-fit flex flex-col items-center px-4">
          {/* ADMIN */}
          <PersonCard
            user={admin || { name: "Administrator", email: "" }}
            role="admin"
            footer={`${mentors.length} mentor${mentors.length !== 1 ? "s" : ""}`}
          />

          {mentors.length === 0 ? (
            <p className="mt-6 text-xs text-slate-400">No mentors registered yet.</p>
          ) : (
            <>
              <div className={`w-px h-8 ${LINE}`} />

              {/* MENTORS ROW */}
              <div className="flex w-full flex-nowrap items-start justify-center">
                {mentors.map((mentor, i) => {
                  const list = byMentor[mentor.id] || [];
                  const isOpen = !closedIds.has(mentor.id);
                  const first = i === 0;
                  const last = i === mentors.length - 1;
                  const single = mentors.length === 1;

                  return (
                    <div key={mentor.id} className="relative flex flex-col items-center flex-1 min-w-0 px-1 pt-8">
                      {/* horizontal connector across the row */}
                      {!single && (
                        <div
                          className={`absolute top-0 h-px ${LINE} ${
                            first ? "left-1/2 right-0" : last ? "left-0 right-1/2" : "left-0 right-0"
                          }`}
                        />
                      )}
                      {/* vertical drop to this mentor */}
                      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-px h-8 ${LINE}`} />

                      <PersonCard
                        user={mentor}
                        role="mentor"
                        onClick={() => toggle(mentor.id)}
                        footer={
                          <>
                            <svg
                              className={`w-3 h-3 transition-transform ${isOpen ? "rotate-90" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                            <span>
                              {list.length} mentee{list.length !== 1 ? "s" : ""}
                            </span>
                          </>
                        }
                      />

                      {/* MENTEES under this mentor */}
                      {isOpen && list.length > 0 && (
                        <div className="relative flex flex-col items-center w-full gap-3 pt-6">
                          <div className={`absolute top-0 bottom-6 left-1/2 -translate-x-1/2 w-px ${LINE}`} />
                          {list.map((mentee) => (
                            <PersonCard key={mentee.id} user={mentee} role="mentee" />
                          ))}
                        </div>
                      )}

                      {isOpen && list.length === 0 && (
                        <p className="pt-4 text-[11px] text-slate-400">No mentees assigned</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* UNASSIGNED */}
      {unassigned.length > 0 && (
        <div className="mt-6 p-5 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/10">
          <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-4">
            Unassigned Mentees ({unassigned.length})
          </h3>
          <div className="flex flex-wrap gap-4">
            {unassigned.map((mentee) => (
              <PersonCard key={mentee.id} user={mentee} role="mentee" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}