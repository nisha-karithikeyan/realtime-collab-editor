import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthApiService } from './services/auth-api.service';
import { TokenStorageService } from './services/token-storage.service';
import { AuthActions } from './store/auth.actions';

/**
 * Attaches the JWT access token to API requests and, on a 401, attempts
 * exactly one silent refresh before giving up and logging the user out -
 * avoids both leaking expired-token errors to the UI and infinite retry
 * loops if the refresh token itself is invalid.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStorage = inject(TokenStorageService);
  const authApi = inject(AuthApiService);
  const store = inject(Store);

  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const accessToken = tokenStorage.getAccessToken();
  const authedReq = accessToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : req;

  return next(authedReq).pipe(
    catchError((error: unknown) => {
      const isAuthEndpoint = req.url.includes('/auth/login/') || req.url.includes('/auth/refresh/');
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        store.dispatch(AuthActions.loggedOut());
        return throwError(() => error);
      }

      return authApi.refresh(refreshToken).pipe(
        switchMap(({ access }) => {
          tokenStorage.setAccessToken(access);
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${access}` } }));
        }),
        catchError((refreshError) => {
          store.dispatch(AuthActions.loggedOut());
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
