// Persist a demo user ID in localStorage so the same "user" survives
// page refreshes. Replaced by JWT auth in the bonus step.
const USER_KEY = 'limited_drop_user_id';

export const DEMO_USER_ID: string = (() => {
  const stored = localStorage.getItem(USER_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(USER_KEY, id);
  return id;
})();
