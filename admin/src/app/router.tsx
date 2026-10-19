import type { ReactNode } from "react";

export type RouterConfig = {
  path: string;
  element: ReactNode;
  protected?: boolean;
};

export const routerConfig: RouterConfig[] = [];
