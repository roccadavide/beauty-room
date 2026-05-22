// Display rule for one composition line of a client package.
// Applied wherever the package's items list is rendered (admin agenda card,
// "Pacchetti attivi" cards, selected-package row in AppointmentForm).
//
//   plain service  → service title
//   service+option → "Service title · Option name"
//   custom row     → custom text as-is
//
// Works with both ClientPackageAssignmentItemDTO and PackageItemSummaryDTO —
// the two response shapes share the relevant fields.
export default function formatPackageItemLabel(item) {
  if (!item) return "";
  if (item.customName && item.customName.trim()) return item.customName.trim();
  const title = (item.serviceTitle || "").trim();
  const opt = (item.serviceOptionName || "").trim();
  if (title && opt) return `${title} · ${opt}`;
  return title || opt || "—";
}
