package daviderocca.beautyroom.email.templates;

public record EmailContent(
        String subject,
        String html,
        String text
) {}