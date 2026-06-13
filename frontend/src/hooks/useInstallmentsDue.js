import { useCallback, useEffect, useMemo, useState } from "react";
import { getInstallmentsDue, getPackageInstallmentSummaries, settlePackageInstallment } from "../api/modules/adminAgenda.api";
import { formatEuro } from "../utils/formatEuro";

// Local YYYY-MM-DD — NOT toISOString() (UTC), which would roll the date backwards in
// the evening in Europe/Rome. Mirrors AdminAgendaPage's own toISODate helper.
const pad2 = n => String(n).padStart(2, "0");
const localISODate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Owns ALL installment-due data + the batched per-package summaries + the settle
// action so AdminAgendaPage stays thin. `dateISO` drives the "due" window (the viewed
// day); `packageIds` are the INSTALLMENTS packages visible that day, summarised for the
// always-on "Pagato X su Y" pill. The settle paidDate is always the real local "today"
// (data odierna), computed fresh at click time.
export default function useInstallmentsDue(dateISO, packageIds, { onError } = {}) {
  const [installmentsDue, setInstallmentsDue] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [confirmInstallment, setConfirmInstallment] = useState(null);
  const [settling, setSettling] = useState(false);

  // Stable primitive key so the summaries effect re-runs only when the SET of ids
  // changes, not on every render (packageIds is a fresh array each time).
  const idsKey = (packageIds || []).join(",");

  const reloadDue = useCallback(async () => {
    try {
      const data = await getInstallmentsDue(dateISO, dateISO);
      setInstallmentsDue(Array.isArray(data) ? data : []);
    } catch (e) {
      onError?.(e.message || "Errore caricamento rate in scadenza.");
      setInstallmentsDue([]);
    }
  }, [dateISO, onError]);

  const reloadSummaries = useCallback(async () => {
    const ids = idsKey ? idsKey.split(",") : []; // rebuilt from the stable key (UUIDs carry no commas)
    try {
      const data = await getPackageInstallmentSummaries(ids);
      setSummaries(Array.isArray(data) ? data : []);
    } catch (e) {
      onError?.(e.message || "Errore caricamento riepilogo rate.");
      setSummaries([]);
    }
  }, [idsKey, onError]);

  // The public reload refreshes BOTH feeds so "Pagato X su Y" and the KPI stay in sync.
  const reload = useCallback(async () => {
    await Promise.all([reloadDue(), reloadSummaries()]);
  }, [reloadDue, reloadSummaries]);

  useEffect(() => {
    reloadDue();
  }, [reloadDue]);

  useEffect(() => {
    reloadSummaries();
  }, [reloadSummaries]);

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

  // Map<packageAssignmentId(string), summary> for the always-on "Pagato X su Y" pill.
  const summaryByPackage = useMemo(() => {
    const map = new Map();
    summaries.forEach(s => map.set(String(s.packageAssignmentId), s));
    return map;
  }, [summaries]);

  // Sums EVERY feed row (paid + unpaid). The feed now includes rate paid today, so a
  // rata settled today stays in this total — the KPI doesn't drop after a settle.
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
    summaryByPackage,
    dueList: installmentsDue,
    dueTotal,
    hasDue: installmentsDue.length > 0,
    settling,
    reload,
    requestSettle,
    confirmProps,
  };
}
