export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  avatarUrl: string | null;
  emailConfirmedAt?: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

const TOKEN_COOKIE = 'auth_token';

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

export function getAuthToken(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === TOKEN_COOKIE && value) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

export function setAuthSession(session: AuthSession, user?: AuthUser): void {
  if (typeof document === 'undefined') return;

  const maxAge = session.expiresIn ? session.expiresIn : 7 * 24 * 60 * 60;
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';

  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(session.accessToken)}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user } }));
  }
}

export function clearAuthSession(): void {
  if (typeof document === 'undefined') return;

  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: null }));
  }
}

export async function loginUser(email: string, password: string): Promise<{ user: AuthUser; session: AuthSession }> {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Login gagal.');
  }

  const { user, session } = json.data;
  setAuthSession(session, user);
  return { user, session };
}

export async function registerUser(
  fullName: string,
  email: string,
  password: string
): Promise<{ user: AuthUser; session: AuthSession | null }> {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, email, password }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Registrasi gagal.');
  }

  const { user, session } = json.data;
  if (session) {
    setAuthSession(session, user);
  }

  return { user, session };
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getAuthToken();
  if (!token) return null;

  const apiUrl = getApiUrl();
  try {
    const res = await fetch(`${apiUrl}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearAuthSession();
      }
      return null;
    }

    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  const token = getAuthToken();
  const apiUrl = getApiUrl();

  try {
    if (token) {
      await fetch(`${apiUrl}/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } finally {
    clearAuthSession();
  }
}

export async function uploadAvatarViaBackend(file: File): Promise<{ avatarUrl: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Autentikasi diperlukan untuk mengunggah avatar.');
  }

  const apiUrl = getApiUrl();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${apiUrl}/v1/profile/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Gagal mengunggah foto profil.');
  }

  return { avatarUrl: json.data.avatarUrl };
}

export async function updateUserPassword(newPassword: string): Promise<void> {
  const token = getAuthToken();
  if (!token) throw new Error('Autentikasi diperlukan.');

  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/v1/auth/password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newPassword }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Gagal memperbarui kata sandi.');
  }
}

export async function resendVerificationEmail(): Promise<void> {
  const token = getAuthToken();
  if (!token) throw new Error('Autentikasi diperlukan.');

  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/v1/auth/resend-verification`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Gagal mengirim email verifikasi.');
  }
}
