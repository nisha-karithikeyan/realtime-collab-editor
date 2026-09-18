import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthTokens, User } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  constructor(private http: HttpClient) {}

  register(email: string, password: string, name: string): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/register/`, { email, password, name });
  }

  login(email: string, password: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.baseUrl}/login/`, { email, password });
  }

  refresh(refresh: string): Observable<{ access: string }> {
    return this.http.post<{ access: string }>(`${this.baseUrl}/refresh/`, { refresh });
  }

  me(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/me/`);
  }

  requestPasswordReset(email: string): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${this.baseUrl}/password-reset/`, { email });
  }

  confirmPasswordReset(
    uid: string,
    token: string,
    new_password: string,
  ): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${this.baseUrl}/password-reset/confirm/`, {
      uid,
      token,
      new_password,
    });
  }
}
