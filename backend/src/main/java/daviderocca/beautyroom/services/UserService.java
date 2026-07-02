package daviderocca.beautyroom.services;

import daviderocca.beautyroom.DTO.userDTOs.NewPasswordDTO;
import daviderocca.beautyroom.DTO.userDTOs.NewUserDTO;
import daviderocca.beautyroom.DTO.userDTOs.UpdateUserDTO;
import daviderocca.beautyroom.DTO.userDTOs.UserResponseDTO;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.Role;
import daviderocca.beautyroom.exceptions.*;
import daviderocca.beautyroom.email.outbox.EmailOutboxService;
import daviderocca.beautyroom.repositories.UserRepository;
import daviderocca.beautyroom.staff.CurrentStaffService;
import daviderocca.beautyroom.staff.StaffMember;
import daviderocca.beautyroom.util.EmailNormalizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder bcrypt;
    private final EmailOutboxService emailOutboxService;
    private final CurrentStaffService currentStaffService;

    // ---------------------------- FIND METHODS ----------------------------

    @Transactional(readOnly = true)
    public Page<UserResponseDTO> findAllUsers(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<User> page = userRepository.findAll(pageable);
        return page.map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    public User findUserById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(userId));
    }

    @Transactional(readOnly = true)
    public UserResponseDTO findUserByIdAndConvert(UUID userId) {
        return convertToDTO(findUserById(userId));
    }

    /**
     * /users/me variant: additionally resolves the caller's staff row (prompt 02).
     * Kept separate from findUserByIdAndConvert so list endpoints never pay an
     * extra staff lookup per user (no N+1).
     */
    @Transactional(readOnly = true)
    public UserResponseDTO findMeAndConvert(UUID userId) {
        User user = findUserById(userId);
        StaffMember staff = currentStaffService.resolveFor(user).orElse(null);
        return convertToDTO(user, staff);
    }

    @Transactional(readOnly = true)
    public User findUserByEmail(String email) {
        return userRepository.findByEmail(EmailNormalizer.normalize(email))
                .orElseThrow(() -> new ResourceNotFoundException(email));
    }

    @Transactional(readOnly = true)
    public UserResponseDTO findUserByEmailAndConvert(String email) {
        return convertToDTO(findUserByEmail(email));
    }

    // ---------------------------- CREATE ----------------------------

    @Transactional
    public UserResponseDTO saveUser(NewUserDTO payload) {
        String normalizedEmail = EmailNormalizer.normalize(payload.email());

        userRepository.findByEmail(normalizedEmail).ifPresent(u -> {
            throw new DuplicateResourceException("L'email appartiene già ad un altro utente");
        });

        userRepository.findByPhone(payload.phone()).ifPresent(u -> {
            throw new DuplicateResourceException("Il numero di telefono appartiene già ad un altro utente");
        });

        User newUser = new User(
                payload.name(),
                payload.surname(),
                normalizedEmail,
                bcrypt.encode(payload.password()),
                payload.phone()
        );

        User saved = userRepository.save(newUser);
        log.info("Utente '{}' (email: {}) creato correttamente", saved.getName(), saved.getEmail());

        try {
            emailOutboxService.enqueueUserRegistered(saved);
        } catch (Exception e) {
            log.warn("Notifica registrazione utente non accodata: {}", e.getMessage());
        }

        return convertToDTO(saved);
    }

    /**
     * Team API (prompt 03): login account for a new staff member. Same uniqueness
     * validation + hashing as the register path, but role STAFF and isVerified=true
     * (staff must be able to operate pay-in-store flows immediately), and no
     * registration email (the owner creates the account, not the person). Joins the
     * caller's transaction so User + staff_members row commit atomically.
     */
    @Transactional
    public User createStaffUser(String name, String surname, String email, String rawPassword, String phone) {
        String normalizedEmail = EmailNormalizer.normalize(email);

        userRepository.findByEmail(normalizedEmail).ifPresent(u -> {
            throw new DuplicateResourceException("L'email appartiene già ad un altro utente");
        });

        userRepository.findByPhone(phone).ifPresent(u -> {
            throw new DuplicateResourceException("Il numero di telefono appartiene già ad un altro utente");
        });

        User newUser = new User(name, surname, normalizedEmail, bcrypt.encode(rawPassword), phone);
        newUser.setRole(Role.STAFF);
        newUser.setVerified(true);

        User saved = userRepository.save(newUser);
        log.info("Utente STAFF '{}' (email: {}) creato correttamente", saved.getName(), saved.getEmail());
        return saved;
    }

    // ---------------------------- UPDATE PROFILE ----------------------------

    @Transactional
    public UserResponseDTO updateUserProfile(UUID idUser, UpdateUserDTO payload) {
        User found = findUserById(idUser);

        String normalizedEmail = EmailNormalizer.normalize(payload.email());

        if (!found.getEmail().equals(normalizedEmail)) {
            userRepository.findByEmail(normalizedEmail).ifPresent(u -> {
                throw new DuplicateResourceException("Email già esistente: " + u.getEmail());
            });
        }

        if (!found.getPhone().equals(payload.phone())) {
            userRepository.findByPhone(payload.phone()).ifPresent(u -> {
                throw new DuplicateResourceException("Numero di telefono già registrato: " + u.getPhone());
            });
        }

        found.setName(payload.name());
        found.setSurname(payload.surname());
        found.setEmail(normalizedEmail);
        found.setPhone(payload.phone());

        User updated = userRepository.save(found);
        log.info("Profilo utente '{}' aggiornato con successo", updated.getEmail());
        return convertToDTO(updated);
    }

    // ---------------------------- UPDATE PASSWORD ----------------------------

    @Transactional
    public UserResponseDTO updateUserPassword(UUID idUser, NewPasswordDTO payload) {
        User found = findUserById(idUser);

        if (!bcrypt.matches(payload.oldPassword(), found.getPassword())) {
            throw new BadRequestException("La password attuale non è corretta.");
        }

        if (bcrypt.matches(payload.newPassword(), found.getPassword())) {
            throw new BadRequestException("La nuova password non può essere uguale alla precedente.");
        }

        if (!payload.newPassword().equals(payload.confirmNewPassword())) {
            throw new BadRequestException("La nuova password e la conferma non coincidono.");
        }

        found.setPassword(bcrypt.encode(payload.newPassword()));
        User updated = userRepository.save(found);

        log.info("Password aggiornata per l'utente '{}'", updated.getEmail());
        return convertToDTO(updated);
    }

    // ---------------------------- TRUST MANAGEMENT ----------------------------

    @Transactional
    public UserResponseDTO setUserVerified(UUID userId, boolean verified) {
        User found = findUserById(userId);
        found.setVerified(verified);
        User updated = userRepository.save(found);
        log.info("Utente '{}' is_verified impostato a {}", updated.getEmail(), verified);
        return convertToDTO(updated);
    }

    // ---------------------------- ROLE MANAGEMENT ----------------------------

    @Transactional
    public UserResponseDTO promoteToAdmin(UUID idUser) {
        User found = findUserById(idUser);

        if (found.getRole() == Role.ADMIN)
            throw new UnauthorizedOperationException("L'utente è già un ADMIN.");

        found.setRole(Role.ADMIN);
        User updated = userRepository.save(found);

        log.info("Utente '{}' promosso a ADMIN", updated.getEmail());
        return convertToDTO(updated);
    }

    @Transactional
    public UserResponseDTO revokeAdmin(UUID idUser) {
        User found = findUserById(idUser);

        if (found.getRole() == Role.CUSTOMER)
            throw new UnauthorizedOperationException("L'utente è già CUSTOMER.");

        found.setRole(Role.CUSTOMER);
        User updated = userRepository.save(found);

        log.info("Utente '{}' retrocesso a CUSTOMER", updated.getEmail());
        return convertToDTO(updated);
    }

    // ---------------------------- DELETE ----------------------------

    @Transactional
    public void deleteUser(UUID idUser) {
        User found = findUserById(idUser);
        userRepository.delete(found);
        log.info("Utente '{}' eliminato correttamente", found.getEmail());
    }

    // ---------------------------- CONVERTER ----------------------------
    private UserResponseDTO convertToDTO(User user) {
        return convertToDTO(user, null);
    }

    private UserResponseDTO convertToDTO(User user, StaffMember staff) {
        return new UserResponseDTO(
                user.getUserId(),
                user.getName(),
                user.getSurname(),
                user.getEmail(),
                user.getPhone(),
                user.getRole(),
                user.isVerified(),
                staff != null ? staff.getId() : null,
                staff != null ? staff.getDisplayName() : null
        );
    }
}
