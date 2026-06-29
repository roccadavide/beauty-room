import { createContext, useContext } from "react";

/**
 * Workspace view context provided by AdminWorkspace.
 * `view` is "agenda" | "clienti"; `setView(next)` writes the `?view=` param.
 * Consumed by WorkspaceSwitch, which is rendered inside each view's own header.
 */
export const WorkspaceContext = createContext({
  view: "agenda",
  setView: () => {},
});

export const useWorkspace = () => useContext(WorkspaceContext);
