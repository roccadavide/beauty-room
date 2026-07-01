import { createContext, useContext } from "react";

/**
 * Workspace view context provided by AdminWorkspace.
 * `view` is "agenda" | "clienti" | "postit"; `setView(next)` writes the `?view=` param.
 * Consumed by WorkspaceSwitch, rendered once in the AdminWorkspace top-bar.
 */
export const WorkspaceContext = createContext({
  view: "agenda",
  setView: () => {},
});

export const useWorkspace = () => useContext(WorkspaceContext);
