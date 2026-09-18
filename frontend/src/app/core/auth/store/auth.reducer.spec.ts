import { User } from '../models';
import { AuthActions } from './auth.actions';
import { authReducer, initialAuthState } from './auth.reducer';

const mockUser: User = {
  id: '1',
  email: 'a@b.com',
  name: 'A B',
  avatar_color: '#6366F1',
  date_joined: '2026-01-01T00:00:00Z',
};

describe('authReducer', () => {
  it('returns the initial state for an unknown action', () => {
    const state = authReducer(undefined, { type: 'noop' } as any);
    expect(state).toEqual(initialAuthState);
  });

  it('sets status to loading on loginSubmitted', () => {
    const state = authReducer(
      initialAuthState,
      AuthActions.loginSubmitted({ email: 'a@b.com', password: 'x' }),
    );
    expect(state.status).toBe('loading');
    expect(state.error).toBeNull();
  });

  it('stores the user and marks authenticated on loginSuccess', () => {
    const state = authReducer(initialAuthState, AuthActions.loginSuccess({ user: mockUser }));
    expect(state.status).toBe('authenticated');
    expect(state.user).toEqual(mockUser);
  });

  it('records the error message on loginFailure without touching the user', () => {
    const loggedIn = authReducer(initialAuthState, AuthActions.loginSuccess({ user: mockUser }));
    const state = authReducer(loggedIn, AuthActions.loginFailure({ error: 'bad creds' }));
    expect(state.status).toBe('error');
    expect(state.error).toBe('bad creds');
  });

  it('resets to the initial state on loggedOut', () => {
    const loggedIn = authReducer(initialAuthState, AuthActions.loginSuccess({ user: mockUser }));
    const state = authReducer(loggedIn, AuthActions.loggedOut());
    expect(state).toEqual(initialAuthState);
  });
});
