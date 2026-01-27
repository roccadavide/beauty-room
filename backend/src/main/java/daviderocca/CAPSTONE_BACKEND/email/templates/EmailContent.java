package daviderocca.CAPSTONE_BACKEND.email.templates;

public record EmailContent(
        String subject,
        String html,
        String text
) {}