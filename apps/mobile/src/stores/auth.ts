import { create } from "zustand";
import type { PublicUser } from "@turney/shared";
import { api } from "../api/client";

type AuthState = {
  user: PublicUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  setUser: (user: PublicUser) => void;
  logout: () => void;
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  login: async (email, password) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  },
  register: async (email, password, displayName) => {
    const data = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    });
    set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    const rt = get().refreshToken;
    if (rt) {
      api("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: rt }) }).catch(
        () => {},
      );
    }
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
