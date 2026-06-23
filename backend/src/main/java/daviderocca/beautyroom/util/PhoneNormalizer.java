package daviderocca.beautyroom.util;

/**
 * Normalizzazione del numero di telefono per la deduplicazione dei clienti.
 *
 * <p>Forma = <b>E.164 canonico con il {@code +} iniziale</b> (es. {@code +393471234567}),
 * ottenuta riducendo l'input alle sole cifre e applicando, ramo per ramo, la stessa
 * euristica del frontend {@code frontend/src/utils/reminders.js → normalizeItalianPhone()}
 * (rilevamento prefisso {@code 39}/lunghezza, prepend del cellulare "nudo", gestione
 * {@code 00}/{@code 0039}), poi anteponendo {@code +}. La migrazione {@code V80} applica
 * la STESSA identica regola in SQL, così la chiave scritta a DB e quella calcolata qui
 * coincidono byte per byte (i lookup via {@code findByPhoneNormalized} matchano le righe
 * riscritte da V80).
 *
 * <p>Serve SOLO come chiave di dedup/lookup per i clienti e per l'indice unico parziale
 * {@code ux_customer_phone}. Il numero "display" ({@code Customer.phone}) resta invariato
 * e leggibile. Input vuoto / senza cifre → {@code null}, così resta fuori dall'indice
 * parziale ({@code WHERE phone_normalized IS NOT NULL}).
 *
 * <p><b>⚠ ATTENZIONE — non confondere i due mondi.</b> Questa forma E.164 è la chiave di
 * <i>dedup clienti</i> (Mondo 1: {@code customers.phone_normalized} ←→
 * {@code findByPhoneNormalized}). Il <i>Mondo 2</i> — history/arretrati lato booking
 * ({@code BookingService.digitsOnly()}, {@code CustomerService.digitsOnly()}, le query
 * native {@code regexp_replace(phone,'[^0-9]','','g')} in {@code BookingRepository}, e
 * l'inline {@code replaceAll("[^0-9]","")} in {@code BookingService}) — è un mondo
 * <b>deliberatamente separato</b>, solo-cifre, alimentato dai numeri <i>display</i> su
 * entrambi i lati. NON legge mai {@code phone_normalized}. NON passare MAI l'output di
 * questo normalizzatore (E.164, col {@code +}) a una query del Mondo 2: il {@code +} e il
 * prefisso {@code 39} forzato romperebbero il match digits-only. Un eventuale refactor che
 * volesse "unificare" i due mondi deve riallineare prima le query native, non riusare
 * questa chiave.
 */
public final class PhoneNormalizer {

    private PhoneNormalizer() {}

    /**
     * Riduce un numero grezzo a E.164 canonico ({@code +39…}) per la dedup clienti.
     *
     * <p>Regola (mirror byte-per-byte di {@code reminders.js → normalizeItalianPhone},
     * e della {@code CASE} in {@code V80__renormalize_customer_phone_e164.sql}):
     * <ol>
     *   <li>riduci a sole cifre (rimuove spazi, {@code +}, trattini, parentesi…);</li>
     *   <li>togli un eventuale prefisso internazionale {@code 00} iniziale;</li>
     *   <li><b>B1</b> — inizia per {@code 39} e lunghezza ≥ 11 → {@code "+" + cifre};</li>
     *   <li><b>B2</b> — esattamente 10 cifre e inizia per {@code 3} (cellulare nudo) → {@code "+39" + cifre};</li>
     *   <li><b>B3</b> — inizia per {@code 39} (più corto) → {@code "+" + cifre};</li>
     *   <li><b>B4</b> — altrimenti (fallback, incl. fisso {@code 0…}) → {@code "+39" + cifre}.</li>
     * </ol>
     *
     * @param phone numero grezzo (può contenere spazi, {@code +}, trattini, parentesi…)
     * @return E.164 canonico {@code +39…}, oppure {@code null} se l'input è null/vuoto/senza cifre
     */
    public static String normalize(String phone) {
        if (phone == null) return null;

        // Riduci a sole cifre: stesso operando su cui lavora la CASE di V80 (sul valore
        // già digits-only della colonna), così Java e SQL partono dall'identico input.
        String digits = phone.replaceAll("[^0-9]", "");
        // Togli un singolo prefisso internazionale "00" (mirror di reminders.js).
        if (digits.startsWith("00")) digits = digits.substring(2);
        if (digits.isEmpty()) return null;

        // B1 — già col country code 39 e lunghezza piena.
        if (digits.startsWith("39") && digits.length() >= 11) return "+" + digits;
        // B2 — cellulare italiano "nudo" (10 cifre, inizia per 3).
        if (digits.length() == 10 && digits.startsWith("3"))   return "+39" + digits;
        // B3 (inizia per 39, più corto) / B4 (fallback: forza il prefisso 39).
        return digits.startsWith("39") ? "+" + digits : "+39" + digits;
    }
}
