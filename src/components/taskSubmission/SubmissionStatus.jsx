const SubmissionStatus = ({ status }) => {
  const styles = {
    completed:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",

    changes_requested:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",

    approved:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  };

  const labels = {
    completed: "Completed",
    changes_requested: "Changes Requested",
    approved: "Approved",
  };

  if (!status) {
    return (
      <span className="text-xs text-slate-400">
        Not Submitted
      </span>
    );
  }

  return (
    <span
      className={`px-3 py-1 rounded-full border text-xs font-bold ${
        styles[status] || ""
      }`}
    >
      {labels[status] || status}
    </span>
  );
};

export default SubmissionStatus;