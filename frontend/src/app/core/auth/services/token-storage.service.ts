import { Injectable } from '@angular/core';
import { AuthTokens } from '../models';

const ACCESS_KEY = 'collab_access_token';
const REFRESH_KEY = 'collab_refresh_token';

/**
 * Wraps localStorage so a private/incognito window or blocked storage
 * doesn't crash the app - auth just falls back to "logged out".
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  getAccessToken(): string | null {
    return this.safeGet(ACCESS_KEY);
  }

  getRefreshToken(): string | null {
    return this.safeGet(REFRESH_KEY);
  }

  setTokens(tokens: AuthTokens): void {
    this.safeSet(ACCESS_KEY, tokens.access);
    this.safeSet(REFRESH_KEY, tokens.refresh);
  }

  setAccessToken(access: string): void {
    this.safeSet(ACCESS_KEY, access);
  }

  clear(): void {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      // storage unavailable - nothing to clear
    }
  }

  private safeGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeSet(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage unavailable (private mode, quota, etc.) - fail silently
    }
  }
}
