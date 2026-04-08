import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import { resolveWaitlistToken } from "../../api/modules/waitlist.api";
import SEO from "../../components/common/SEO";

/**
 * Pagina intermediaria per il deep link da email lista d'attesa.
 * URL: /prenotazione/waitlist?token=xxxx
 * Risolve il token e redirecta al servizio con i dati pre-compilati.
 */
export default function WaitlistPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [err, setErr] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setErr("Link non valido.");
      return;
    }

    resolveWaitlistToken(token)
      .then(data => {
        navigate(`/trattamenti/${data.serviceId}`, {
          state: {
            openBooking: true,
            prefill: {
              date: data.requestedDate,
              time: data.requestedTime,
              customerName: data.customerName,
              customerEmail: data.customerEmail,
              customerPhone: data.customerPhone,
              waitlistId: data.waitlistId,
            },
          },
        });
      })
      .catch(e => {
        setErr(e?.response?.data?.message || "Il link è scaduto o non è più valido.");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (err)
    return (
      <>
        <SEO
          title="Lista d'attesa"
          description="Sei in lista d'attesa per un trattamento di Beauty Room. Ti contatteremo appena si libera uno slot."
          noindex={true}
        />
        <div style={{ textAlign: "center", padding: "6rem 2rem", fontFamily: "Georgia, serif" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>😔</div>
          <h2 style={{ color: "#3e2723" }}>Link non valido</h2>
          <p style={{ color: "#8d6e63" }}>{err}</p>
          <a href="/trattamenti" style={{ color: "#b8976a" }}>
            Torna ai trattamenti →
          </a>
        </div>
      </>
    );

  return (
    <>
      <SEO
        title="Lista d'attesa"
        description="Sei in lista d'attesa per un trattamento di Beauty Room. Ti contatteremo appena si libera uno slot."
        noindex={true}
      />
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center" }}>
          <Spinner animation="border" style={{ color: "#b8976a" }} />
          <p style={{ color: "#8d6e63", marginTop: "1rem", fontFamily: "Georgia, serif" }}>Preparazione prenotazione…</p>
        </div>
      </div>
    </>
  );
}
