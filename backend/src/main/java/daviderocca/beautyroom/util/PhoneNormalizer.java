package daviderocca.beautyroom.util;

/**
 * Normalizzazione del numero di telefono per la deduplicazione dei clienti.
 *
 * <p>Forma = <b>solo cifre</b> (tutti i caratteri non numerici rimossi), la STESSA
 * usata dalle query native lato booking per history/arretrati
 * ({@code regexp_replace(phone,'[^0-9]','','g')}): così la chiave di dedup e quella
 * di ricerca storica restano coerenti senza alcun blast radius.
 *
 * <p>Serve SOLO come chiave di dedup/lookup e per l'indice unico parziale
 * {@code ux_customer_phone}. Il numero "display" ({@code Customer.phone}) resta
 * invariato e leggibile.
 *
 * <p>Un input vuoto / senza cifre diventa {@code null}, così resta fuori dall'indice
 * unico parziale ({@code WHERE phone_normalized IS NOT NULL}), esattamente come faceva
 * il vecchio indice parziale sul {@code phone} raw.
 */
public final class PhoneNormalizer {

    private PhoneNormalizer() {}

    /**
     * @param phone numero grezzo (può contenere spazi, {@code +}, trattini, parentesi…)
     * @return solo le cifre, oppure {@code null} se l'input è null/vuoto/senza cifre
     */
    public static String normalize(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("[^0-9]", "");
        return digits.isEmpty() ? null : digits;
    }
}
