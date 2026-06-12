"use client";

import { createContext, useContext } from "react";
import type { Branch } from "./types";
import type { UserRole } from "./user-role";

export interface BranchOwnerCtx {
  branch: Branch | "All";
  ownerMode: boolean;
  /** Session role; server-side guards are the real boundary — this is for UI gating only. */
  role: UserRole | null;
}

export const BranchOwnerContext = createContext<BranchOwnerCtx>({
  branch: "All",
  ownerMode: false,
  role: null,
});

export function useBranchOwner() {
  return useContext(BranchOwnerContext);
}
