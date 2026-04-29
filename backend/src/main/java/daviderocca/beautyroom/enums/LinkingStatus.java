package daviderocca.beautyroom.enums;

/**
 * Outcome of the auto account-linking attempt on a booking or package assignment.
 *
 * NONE       — default, not yet processed
 * LINKED     — exactly one account found with the same full name → linked
 * UNMATCHED  — no account with that name at link time
 * AMBIGUOUS  — two or more accounts found → manual review required
 */
public enum LinkingStatus {
    NONE,
    LINKED,
    UNMATCHED,
    AMBIGUOUS
}
