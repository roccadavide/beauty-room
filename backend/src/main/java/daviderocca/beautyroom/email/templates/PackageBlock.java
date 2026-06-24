package daviderocca.beautyroom.email.templates;

import java.util.List;

/**
 * Contextual package box (NOT a priced line). The package's money is always carried by the
 * grand total / payment label, never shown inline here.
 * - headline           → admin: the package NAME ("Laser ascelle"); online: "Pacchetto: 5 sedute di Laser, valido fino al 12 giu 2028"
 * - sessionInfo        → admin: "Seduta 3 di 6 · ne restano 3"; online: "5 sedute · 5 rimanenti"
 * - covered            → true when this session is prepaid/included (renders "Già saldato ✦")
 * - attachedTreatments → the package's composition (admin only); rendered as a small muted list. Empty when none.
 */
public record PackageBlock(String headline, String sessionInfo, boolean covered,
                           List<String> attachedTreatments) {}
