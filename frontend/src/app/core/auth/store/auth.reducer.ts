import { createReducer, on } from '@ngrx/store';
import { User } from '../models';
import { AuthActions } from './auth.actions';

export interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  error: string | null;
  resetRequestStatus: 'idle' | 'loading' | 'sent' | 'error';
  resetConfirmStatus: 'idle' | 'loading' | 'done' | 'error';
  resetError: string | null;
}

export const initialAuthState: AuthState = {
  user: null,
  status: 'idle',
  error: null,
  resetRequestStatus: 'idle',
  resetConfirmStatus: 'idle',
  resetError: null,
};

export const authReducer = createReducer(
  initialAuthState,

  on(AuthActions.loginSubmitted, AuthActions.registerSubmitted, (state) => ({
    ...state,
    status: 'loading' as const,
    error: null,
  })),

  on(AuthActions.loginSuccess, (state, { user }) => ({
    ...state,
    user,
    status: 'authenticated' as const,
    error: null,
  })),

  on(AuthActions.sessionRestored, (state, { user }) => ({
    ...state,
    user,
    status: 'authenticated' as const,
  })),

  on(AuthActions.sessionRestoreFailed, (state) => ({
    ...state,
    user: null,
    status: 'idle' as const,
  })),

  on(AuthActions.loginFailure, (state, { error }) => ({
    ...state,
    status: 'error' as const,
    error,
  })),

  on(AuthActions.registerSuccess, (state) => ({
    ...state,
    status: 'idle' as const,
    error: null,
  })),

  on(AuthActions.registerFailure, (state, { error }) => ({
    ...state,
    status: 'error' as const,
    error,
  })),

  on(AuthActions.passwordResetRequested, (state) => ({
    ...state,
    resetRequestStatus: 'loading' as const,
    resetError: null,
  })),
  on(AuthActions.passwordResetRequestSuccess, (state) => ({
    ...state,
    resetRequestStatus: 'sent' as const,
  })),
  on(AuthActions.passwordResetRequestFailure, (state, { error }) => ({
    ...state,
    resetRequestStatus: 'error' as const,
    resetError: error,
  })),

  on(AuthActions.passwordResetConfirmed, (state) => ({
    ...state,
    resetConfirmStatus: 'loading' as const,
    resetError: null,
  })),
  on(AuthActions.passwordResetConfirmSuccess, (state) => ({
    ...state,
    resetConfirmStatus: 'done' as const,
  })),
  on(AuthActions.passwordResetConfirmFailure, (state, { error }) => ({
    ...state,
    resetConfirmStatus: 'error' as const,
    resetError: error,
  })),

  on(AuthActions.loggedOut, () => initialAuthState),
);
