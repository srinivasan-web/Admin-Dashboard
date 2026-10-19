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

export type AuthSessionState = "login" | "register" | "admin";
