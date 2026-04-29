package daviderocca.beautyroom.linking;

import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.LinkingStatus;

/**
 * Result of a name-based account linking attempt.
 */
public record LinkingOutcome(LinkingStatus status, User user) {

    public static LinkingOutcome none() {
        return new LinkingOutcome(LinkingStatus.NONE, null);
    }

    public static LinkingOutcome linked(User user) {
        return new LinkingOutcome(LinkingStatus.LINKED, user);
    }

    public static LinkingOutcome unmatched() {
        return new LinkingOutcome(LinkingStatus.UNMATCHED, null);
    }

    public static LinkingOutcome ambiguous() {
        return new LinkingOutcome(LinkingStatus.AMBIGUOUS, null);
    }
}
