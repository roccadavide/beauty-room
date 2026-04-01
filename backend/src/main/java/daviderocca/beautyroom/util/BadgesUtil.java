package daviderocca.beautyroom.util;

import daviderocca.beautyroom.exceptions.BadRequestException;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Utility per la gestione dei badge (serializzazione/deserializzazione JSON array string
 * senza dipendenze extra) e per la validazione dei valori ammessi.
 */
public final class BadgesUtil {

    /** Valori ammessi per i badge. */
    public static final Set<String> ALLOWED = Set.of(
            "new", "sale", "promo", "limited", "bestseller", "coming_soon"
    );

    private BadgesUtil() {}

    // ------------------------------------------------------------------ //
    //  SERIALIZZAZIONE  List<String> → JSON string                        //
    // ------------------------------------------------------------------ //

    /**
     * Converte una lista di badge in una stringa JSON array da persistere.
     * Restituisce null se la lista è null o vuota.
     */
    public static String toJson(List<String> badges) {
        if (badges == null || badges.isEmpty()) return null;
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < badges.size(); i++) {
            sb.append('"').append(escape(badges.get(i))).append('"');
            if (i < badges.size() - 1) sb.append(',');
        }
        sb.append(']');
        return sb.toString();
    }

    // ------------------------------------------------------------------ //
    //  DESERIALIZZAZIONE  JSON string → List<String>                      //
    // ------------------------------------------------------------------ //

    /**
     * Converte la stringa JSON array persistita in una lista Java.
     * Restituisce una lista vuota se il valore è null o non parsificabile.
     */
    public static List<String> fromJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        String trimmed = json.trim();
        if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return List.of();
        String inner = trimmed.substring(1, trimmed.length() - 1).trim();
        if (inner.isEmpty()) return List.of();

        List<String> result = new ArrayList<>();
        for (String token : inner.split(",")) {
            String t = token.trim();
            if (t.startsWith("\"") && t.endsWith("\"") && t.length() >= 2) {
                result.add(t.substring(1, t.length() - 1));
            }
        }
        return List.copyOf(result);
    }

    // ------------------------------------------------------------------ //
    //  VALIDAZIONE                                                         //
    // ------------------------------------------------------------------ //

    /**
     * Valida la lista badge: lancia BadRequestException se contiene valori non ammessi.
     * Restituisce la stessa lista (immutabile) se tutti i valori sono validi.
     */
    public static List<String> validate(List<String> badges) {
        if (badges == null || badges.isEmpty()) return badges;
        for (String badge : badges) {
            if (!ALLOWED.contains(badge)) {
                throw new BadRequestException(
                        "Badge non valido: '" + badge + "'. Valori ammessi: " + ALLOWED);
            }
        }
        return badges;
    }

    // ------------------------------------------------------------------ //
    //  HELPER                                                              //
    // ------------------------------------------------------------------ //

    private static String escape(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
