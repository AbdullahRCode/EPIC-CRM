"use client";

import { createContext, useContext } from "react";
import type { Branch } from "./types";

export interface BranchOwnerCtx {
  branch: Branch | "All";
  ownerMode: boolean;
}

export const BranchOwnerContext = createContext<BranchOwnerCtx>({
  branch: "All",
  ownerMode: false,
});

export function useBranchOwner() {
  return useContext(BranchOwnerContext);
}
