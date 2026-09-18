import { HttpErrorResponse } from '@angular/common/http';
import { extractErrorMessage } from './extract-error-message';

describe('extractErrorMessage', () => {
  it('returns a network message for status 0', () => {
    const error = new HttpErrorResponse({ status: 0 });
    expect(extractErrorMessage(error)).toContain('Could not reach the server');
  });

  it('uses the detail field when present', () => {
    const error = new HttpErrorResponse({ status: 401, error: { detail: 'Incorrect credentials' } });
    expect(extractErrorMessage(error)).toBe('Incorrect credentials');
  });

  it('flattens field validation errors', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { email: ['This field is required.'], password: ['Too short.'] },
    });
    expect(extractErrorMessage(error)).toBe('This field is required. Too short.');
  });

  it('falls back to the default message for non-HTTP errors', () => {
    expect(extractErrorMessage(new Error('boom'), 'fallback text')).toBe('fallback text');
  });
});
