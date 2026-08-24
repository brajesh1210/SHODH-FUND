import type { Role } from "@/lib/types";

export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("sf_user");
  localStorage.removeItem("sf_role");
  localStorage.removeItem("sf_token");
}

export function rolePath(role: Role) {
  if (role === "PI") return "/dashboard/pi";
  if (role === "FINANCE") return "/dashboard/finance";
  if (role === "AUDITOR") return "/dashboard/auditor";
  return "/dashboard/admin";
}
