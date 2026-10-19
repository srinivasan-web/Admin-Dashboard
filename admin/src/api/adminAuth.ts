import { apiRequest, type ApiResponse } from "./client";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  permissions?: string[];
};

export type InitialRegistration = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
};

export function registerInitialAdmin(data: InitialRegistration) {
  return apiRequest<ApiResponse<{ user: AdminUser }>>(
    "/auth/register",
    "POST",
    data,
  );
}

export function login(email: string, password: string) {
  return apiRequest<ApiResponse<{ user: AdminUser }>>("/auth/login", "POST", {
    email,
    password,
  });
}

export function currentAdmin() {
  return apiRequest<ApiResponse<{ user: AdminUser }>>("/auth/me");
}

export function logout() {
  return apiRequest<void>("/auth/logout", "POST");
}
