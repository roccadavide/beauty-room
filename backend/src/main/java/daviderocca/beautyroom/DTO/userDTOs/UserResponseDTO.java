package daviderocca.beautyroom.DTO.userDTOs;

import daviderocca.beautyroom.enums.Role;

import java.util.UUID;

public record UserResponseDTO(
        UUID id,
        String name,
        String surname,
        String email,
        String phone,
        Role role,
        boolean isVerified,
        // Prompt 02 (additive): populated only by /users/me when a staff_members row
        // links to this user; null everywhere else.
        UUID staffId,
        String staffName
)
{}
