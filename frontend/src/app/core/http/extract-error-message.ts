import { HttpErrorResponse } from '@angular/common/http';

/**
 * DRF error bodies vary by shape: {"detail": "..."} for auth/permission
 * errors, or {"field": ["msg"]} for serializer validation errors. This
 * flattens either into one human-readable string for the UI.
 */
export function extractErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (error.status === 0) {
    return 'Could not reach the server. Check your connection and try again.';
  }

  const body = error.error;
  if (!body || typeof body !== 'object') {
    return fallback;
  }

  if (typeof body.detail === 'string') {
    return body.detail;
  }

  const fieldErrors = Object.values(body)
    .flat()
    .filter((v): v is string => typeof v === 'string');

  return fieldErrors.length > 0 ? fieldErrors.join(' ') : fallback;
}
