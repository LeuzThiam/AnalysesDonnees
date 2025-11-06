// API utilitaires demo pour auth local (à remplacer par /api/auth/* si besoin)
export function fakeLogin(email) {
  const u = { email };
  localStorage.setItem("__demo_user__", JSON.stringify(u));
  return Promise.resolve(u);
}
export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem("__demo_user__")||"null"); } catch { return null; }
}
export function logout() {
  localStorage.removeItem("__demo_user__");
  return true;
}
