import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { User } from '../models';

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    'Login Submitted': props<{ email: string; password: string }>(),
    'Login Success': props<{ user: User }>(),
    'Login Failure': props<{ error: string }>(),

    'Register Submitted': props<{ email: string; password: string; name: string }>(),
    'Register Success': emptyProps(),
    'Register Failure': props<{ error: string }>(),

    'Session Restored': props<{ user: User }>(),
    'Session Restore Failed': emptyProps(),

    'Password Reset Requested': props<{ email: string }>(),
    'Password Reset Request Success': emptyProps(),
    'Password Reset Request Failure': props<{ error: string }>(),

    'Password Reset Confirmed': props<{ uid: string; token: string; new_password: string }>(),
    'Password Reset Confirm Success': emptyProps(),
    'Password Reset Confirm Failure': props<{ error: string }>(),

    'Logged Out': emptyProps(),
  },
});
