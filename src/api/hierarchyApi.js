const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function fetchHierarchy() {
  const token = localStorage.getItem('accessToken'); // change to wherever you store it

  const res = await fetch(`${API_BASE}/users/hierarchy`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load hierarchy');
  }

  return res.json(); // { tree, unassignedMentees }
}