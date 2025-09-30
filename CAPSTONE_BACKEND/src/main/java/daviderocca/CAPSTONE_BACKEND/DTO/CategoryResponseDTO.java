package daviderocca.CAPSTONE_BACKEND.DTO;

import java.util.UUID;

public record CategoryResponseDTO (UUID categoryId, String categoryKey, String label)
{}
