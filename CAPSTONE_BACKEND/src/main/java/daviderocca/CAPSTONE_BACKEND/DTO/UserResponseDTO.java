package daviderocca.CAPSTONE_BACKEND.DTO;

import daviderocca.CAPSTONE_BACKEND.enums.Role;

import java.util.UUID;

public record UserResponseDTO(
        UUID id,
        String name,
        String surname,
        String email,
        String phone,
        Role role
)
{}
