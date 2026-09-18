import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of, switchMap, tap } from 'rxjs';
import { extractErrorMessage } from '../../http/extract-error-message';
import { AuthApiService } from '../services/auth-api.service';
import { TokenStorageService } from '../services/token-storage.service';
import { AuthActions } from './auth.actions';

@Injectable()
export class AuthEffects {
  // inject() at the field level, declared before the effect fields below -
  // guarantees these are assigned before createEffect() reads them.
  // (Constructor-parameter injection does NOT give that guarantee: compiled
  // field initializers run before the constructor body assigns
  // parameter properties, so `this.actions$` would still be undefined
  // when `createEffect(() => this.actions$.pipe(...))` executes.)
  private actions$ = inject(Actions);
  private authApi = inject(AuthApiService);
  private tokenStorage = inject(TokenStorageService);
  private router = inject(Router);

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loginSubmitted),
      exhaustMap(({ email, password }) =>
        this.authApi.login(email, password).pipe(
          switchMap((tokens) => {
            this.tokenStorage.setTokens(tokens);
            return this.authApi.me();
          }),
          map((user) => AuthActions.loginSuccess({ user })),
          catchError((error) =>
            of(
              AuthActions.loginFailure({
                error: extractErrorMessage(error, 'Incorrect email or password.'),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  loginSuccessRedirect$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess),
        tap(() => this.router.navigateByUrl('/documents')),
      ),
    { dispatch: false },
  );

  register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.registerSubmitted),
      exhaustMap(({ email, password, name }) =>
        this.authApi.register(email, password, name).pipe(
          map(() => AuthActions.registerSuccess()),
          catchError((error) =>
            of(AuthActions.registerFailure({ error: extractErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  registerSuccessRedirect$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.registerSuccess),
        tap(() =>
          this.router.navigate(['/login'], { queryParams: { registered: '1' } }),
        ),
      ),
    { dispatch: false },
  );

  requestPasswordReset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.passwordResetRequested),
      exhaustMap(({ email }) =>
        this.authApi.requestPasswordReset(email).pipe(
          map(() => AuthActions.passwordResetRequestSuccess()),
          catchError((error) =>
            of(AuthActions.passwordResetRequestFailure({ error: extractErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  confirmPasswordReset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.passwordResetConfirmed),
      exhaustMap(({ uid, token, new_password }) =>
        this.authApi.confirmPasswordReset(uid, token, new_password).pipe(
          map(() => AuthActions.passwordResetConfirmSuccess()),
          catchError((error) =>
            of(
              AuthActions.passwordResetConfirmFailure({
                error: extractErrorMessage(error, 'That reset link is invalid or has expired.'),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  resetConfirmSuccessRedirect$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.passwordResetConfirmSuccess),
        tap(() => this.router.navigate(['/login'], { queryParams: { reset: '1' } })),
      ),
    { dispatch: false },
  );

  logout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loggedOut),
        tap(() => {
          this.tokenStorage.clear();
          this.router.navigateByUrl('/login');
        }),
      ),
    { dispatch: false },
  );
}
