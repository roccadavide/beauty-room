import { useWorkspace } from "./WorkspaceContext";

// Three workspaces: the agenda, the clients hub and the post-it board. The order
// here defines the segment order (and the sliding pill's translateX index).
const SEGMENTS = [
  { key: "agenda", label: "Agenda" },
  { key: "clienti", label: "Clienti" },
  { key: "postit", label: "Post-it" },
];

/**
 * Primary workspace navigation: a gold segmented control that switches the whole
 * page between Agenda and Clienti. Rendered once in the persistent AdminWorkspace
 * top-bar so it is always reachable. Reads {view, setView} from WorkspaceContext.
 *
 * The sliding indicator uses transform: translateX — that is LOCAL to the pill and
 * does not affect any position:fixed element (the page-swap fade wrapper, by
 * contrast, must stay opacity-only). prefers-reduced-motion disables the slide.
 */
export default function WorkspaceSwitch({ postitBadge = 0 }) {
  const { view, setView } = useWorkspace();
  const activeIndex = Math.max(0, SEGMENTS.findIndex(s => s.key === view));

  const onKeyDown = e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = SEGMENTS[(activeIndex + dir + SEGMENTS.length) % SEGMENTS.length];
    setView(next.key);
  };

  return (
    <div className="wsw" role="tablist" aria-label="Area di lavoro" onKeyDown={onKeyDown}>
      <span
        className="wsw__pill"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
        aria-hidden="true"
      />
      {SEGMENTS.map(s => {
        const isActive = s.key === view;
        return (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`wsw__seg${isActive ? " is-active" : ""}`}
            onClick={() => setView(s.key)}
          >
            {isActive && (
              <span className="wsw__mark" aria-hidden="true">✦</span>
            )}
            <span className="wsw__label">{s.label}</span>
            {s.key === "postit" && postitBadge > 0 && (
              <span className="wsw__badge" aria-label={`${postitBadge} in scadenza o scadute`}>
                {postitBadge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
