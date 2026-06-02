/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const saveSession = useCallback(({ token: nextToken, user: nextUser }) => {
    localStorage.setItem("token", nextToken);
    localStorage.setItem("user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const login = useCallback(async (form) => {
    const { data } = await api.post("/auth/login", form);
    saveSession(data);
    return data;
  }, [saveSession]);

  const signup = useCallback(async (form) => {
    const { data } = await api.post("/auth/signup", form);
    saveSession(data);
    return data;
  }, [saveSession]);

  const adminLogin = useCallback(async (form) => {
    const { data } = await api.post("/admin/auth/login", form);
    saveSession(data);
    return data;
  }, [saveSession]);

  const adminSignup = useCallback(async (form) => {
    const { data } = await api.post("/admin/auth/signup", form);
    saveSession(data);
    return data;
  }, [saveSession]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      adminLogin,
      adminSignup,
      login,
      logout,
      signup,
      token,
      user,
    }),
    [adminLogin, adminSignup, login, logout, signup, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
