import React, { createContext, useContext, useEffect, useState } from "react";
const Ctx = createContext(null);
export function AuthProvider({ children }){
  const [user, setUser] = useState(null);
  useEffect(()=>{ const u=localStorage.getItem("user"); if (u) setUser(JSON.parse(u)); },[]);
  const login = (email)=>{ const u={ email }; localStorage.setItem("user", JSON.stringify(u)); setUser(u); };
  const logout = ()=>{ localStorage.removeItem("user"); setUser(null); };
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = ()=> useContext(Ctx);
