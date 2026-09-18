import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AuthState } from './auth.reducer';

export const selectAuthState = createFeatureSelector<AuthState>('auth');

export const selectCurrentUser = createSelector(selectAuthState, (state) => state.user);
export const selectIsAuthenticated = createSelector(
  selectAuthState,
  (state) => state.status === 'authenticated',
);
export const selectAuthStatus = createSelector(selectAuthState, (state) => state.status);
export const selectAuthError = createSelector(selectAuthState, (state) => state.error);

export const selectResetRequestStatus = createSelector(
  selectAuthState,
  (state) => state.resetRequestStatus,
);
export const selectResetConfirmStatus = createSelector(
  selectAuthState,
  (state) => state.resetConfirmStatus,
);
export const selectResetError = createSelector(selectAuthState, (state) => state.resetError);
