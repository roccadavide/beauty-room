import { useCallback, useEffect, useMemo, useState } from "react";
import { getInstallmentsDue, settlePackageInstallment } from "../api/modules/adminAgenda.api";
import { formatEuro } from "../utils/formatEuro";

// Local YYYY-MM-DD — NOT toISOString() (UTC), which would roll the date backwards in
// the evening in Europe/Rome. Mirrors AdminAgendaPage's own toISODate helper.
const pad2 = n => String(n).padStart(2, "0");
const localISODate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Owns ALL installment-due data + the settle action so AdminAgendaPage stays thin.
// `dateISO` drives the "due" window (the viewed day); the settle paidDate is always
// the real local "today" (data odierna), computed fresh at click time.
export default function useInstallmentsDue(dateISO, { onError } = {}) {
  const [installmentsDue, setInstallmentsDue] = useState([]);
  const [confirmInstallment, setConfirmInstallment] = useState(null);
  const [settling, setSettling] = useState(false);

  const reload = useCallback(async () => {
    try {
      const data = await getInstallmentsDue(dateISO, dateISO);
      setInstallmentsDue(Array.isArray(data) ? data : []);
    } catch (e) {
      onError?.(e.message || "Errore caricamento rate in scadenza.");
      setInstallmentsDue([]);
    }
  }, [dateISO, onError]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Map<packageAssignmentId(string), dueRow[]> — keyed as String to match how the
  // agenda card compares pkg.packageAssignmentId.
  const dueByPackage = useMemo(() => {
    const map = new Map();
    installmentsDue.forEach(row => {
      const key = String(row.packageAssignmentId);
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    });
    return map;
  }, [installmentsDue]);

  const dueTotal = useMemo(
    () => installmentsDue.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [installmentsDue],
  );

  // Accepts either the agenda's explicit { assignmentId, ... } shape or a raw feed row
  // (which carries packageAssignmentId) — the EstimatoModal section passes the latter.
  const requestSettle = useCallback(row => {
    setConfirmInstallment({
      assignmentId: row.assignmentId ?? row.packageAssignmentId,
      installmentId: row.installmentId,
      clientName: row.clientName,
      amount: row.amount,
    });
  }, []);

  const executeSettle = useCallback(async () => {
    if (settling || !confirmInstallment) return;
    const { assignmentId, installmentId } = confirmInstallment;
    setSettling(true);
    try {
      await settlePackageInstallment(assignmentId, installmentId, { paidDate: localISODate(new Date()) });
      await reload();
    } catch (e) {
      onError?.(e.message || "Errore durante il saldo della rata.");
    } finally {
      setSettling(false);
      setConfirmInstallment(null);
    }
  }, [settling, confirmInstallment, reload, onError]);

  const confirmProps = useMemo(
    () => ({
      show: !!confirmInstallment,
      onHide: () => setConfirmInstallment(null),
      onConfirm: executeSettle,
      title: "Salda rata",
      message: confirmInstallment
        ? `Confermi di saldare la rata di ${confirmInstallment.clientName} — ${formatEuro(confirmInstallment.amount)}? Verrà registrata con data odierna.`
        : "",
      confirmLabel: "Salda",
      confirmVariant: "primary",
    }),
    [confirmInstallment, executeSettle],
  );

  return {
    dueByPackage,
    dueList: installmentsDue,
    dueTotal,
    hasDue: installmentsDue.length > 0,
    settling,
    reload,
    requestSettle,
    confirmProps,
  };
}
