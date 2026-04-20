export const CATEGORY_PALETTE = {
  viso:                { bg: "#faeee0", color: "#8c6d3f" },
  corpo:               { bg: "#f2e6d4", color: "#7a5830" },
  laser:               { bg: "#e2ecf4", color: "#3d6278" },
  epilazione:          { bg: "#f5e4e8", color: "#8c4055" },
  mani:                { bg: "#ede6f5", color: "#6a4e8a" },
  piedi:               { bg: "#e4f0e8", color: "#3d6e50" },
  "trucco permanente": { bg: "#f0e0ec", color: "#7a2d58" },
};

export function getCategoryStyle(label = "") {
  const key = label.trim().toLowerCase();
  return CATEGORY_PALETTE[key] ?? { bg: "#ede8e0", color: "#5a4a3a" };
}
