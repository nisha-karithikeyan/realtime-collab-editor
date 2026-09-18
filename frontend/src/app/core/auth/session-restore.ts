import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from './services/auth-api.service';
import { TokenStorageService } from './services/token-storage.service';
import { AuthActions } from './store/auth.actions';

/**
 * Runs once at app bootstrap: if an access token is already in storage
 * (page refresh, new tab), validate it against /me/ and restore the
 * session before the router evaluates any auth guards. Without this,
 * every reload would bounce a logged-in user back to /login.
 */
export function restoreSessionOnBootstrap(): () => Promise<void> {
  return async () => {
    const tokenStorage = inject(TokenStorageService);
    const authApi = inject(AuthApiService);
    const store = inject(Store);

    if (!tokenStorage.getAccessToken()) {
      store.dispatch(AuthActions.sessionRestoreFailed());
      return;
    }

    try {
      const user = await firstValueFrom(authApi.me());
      store.dispatch(AuthActions.sessionRestored({ user }));
    } catch {
      tokenStorage.clear();
      store.dispatch(AuthActions.sessionRestoreFailed());
    }
  };
}
