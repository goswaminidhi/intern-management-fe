import { Link } from 'react-router-dom';
import { useActiveTimer } from '../hooks/useActiveTimer';
import { formatDuration } from '../utils/formatDuration';

export default function ActiveTimerBadge({ enabled }) {
  const { active, elapsedSeconds } = useActiveTimer(enabled);
  if (!active) return null;

  return (
    <Link
      to={`/tasks/${active.log.task_id}`} // match your task detail route
      className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700"
      title="Timer running. Click to open the task"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
      <span className="max-w-40 truncate">{active.log.task?.title ?? 'Task'}</span>
      <span className="font-mono">{formatDuration(elapsedSeconds)}</span>
    </Link>
  );
}