// Persist a demo user in localStorage so the same "user" survives page refreshes.
// On first visit the user is registered with the backend; subsequent visits reuse
// the stored id without hitting the network. Replaced by JWT auth in the bonus step.
import { apiClient, ApiError } from '@/api/client';

const USER_ID_KEY = 'limited_drop_user_id';
const USER_REGISTERED_KEY = 'limited_drop_user_registered';

interface UserResponse {
  success: boolean;
  data: { id: string; email: string; name: string };
}

export async function ensureUser(): Promise<string> {
  const storedId = localStorage.getItem(USER_ID_KEY);
  const isRegistered = localStorage.getItem(USER_REGISTERED_KEY) === '1';

  if (storedId && isRegistered) return storedId;

  // Use stored id (or a fresh UUID) as the seed for a unique stub email.
  const seed = storedId ?? crypto.randomUUID();

  try {
    const res = await apiClient.post<UserResponse>('/users', {
      email: `${seed}@demo.local`,
      name: 'Demo User',
      password: crypto.randomUUID(),
    });
    const id = res.data.id;
    localStorage.setItem(USER_ID_KEY, id);
    localStorage.setItem(USER_REGISTERED_KEY, '1');
    return id;
  } catch (err) {
    // 409 means this seed was already registered (e.g. registration flag was cleared).
    // The stored id is still valid — mark it as registered and reuse it.
    if (err instanceof ApiError && err.status === 409 && storedId) {
      localStorage.setItem(USER_REGISTERED_KEY, '1');
      return storedId;
    }
    throw err;
  }
}
