export type AuthUser = {
  id: string;
  username: string;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type RegisterPayload = LoginPayload;
