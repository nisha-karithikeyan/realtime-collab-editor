export interface User {
  id: string;
  email: string;
  name: string;
  avatar_color: string;
  date_joined: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface ApiError {
  detail?: string;
  [field: string]: unknown;
}
