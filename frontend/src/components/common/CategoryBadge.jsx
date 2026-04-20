import { getCategoryStyle } from "../../constants/categoryPalette";

export default function CategoryBadge({ label, className = "" }) {
  if (!label) return null;
  const { bg, color } = getCategoryStyle(label);
  return (
    <span
      className={`cat-badge ${className}`}
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}
