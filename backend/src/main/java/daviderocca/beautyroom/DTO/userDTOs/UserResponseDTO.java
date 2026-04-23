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
        boolean isVerified
)
{}
