import { useEffect, useState } from 'react';
import { fetchHierarchy } from '../services/hierarchyApi';
import TreeNode from '../components/Hierarchy/HierarchyTree';
import '../components/Hierarchy/Hierarchy.css';

export default function HierarchyPage() {
  const [tree, setTree] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchHierarchy();
        if (cancelled) return;
        setTree(data.tree || []);
        setUnassigned(data.unassignedMentees || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="hierarchy-page">Loading hierarchy...</p>;
  if (error) return <p className="hierarchy-page hierarchy-error">{error}</p>;

  return (
    <div className="hierarchy-page">
      <h2>Team Hierarchy</h2>

      {tree.length === 0 ? (
        <p>No data found.</p>
      ) : (
        <ul className="tree-root">
          {tree.map((admin) => (
            <TreeNode key={admin.id} node={admin} defaultOpen />
          ))}
        </ul>
      )}

      {unassigned.length > 0 && (
        <div className="unassigned-section">
          <h3>Unassigned Mentees ({unassigned.length})</h3>
          <ul className="tree-root">
            {unassigned.map((mentee) => (
              <TreeNode key={mentee.id} node={{ ...mentee, children: [] }} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}