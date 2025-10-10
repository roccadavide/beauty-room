package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.*;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.Role;
import daviderocca.CAPSTONE_BACKEND.exceptions.*;
import daviderocca.CAPSTONE_BACKEND.repositories.UserRepository;
import org.springframework.transaction.annotation.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@Slf4j
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder bcrypt;

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

    @Transactional(readOnly = true)
    public User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(email));
    }

    @Transactional(readOnly = true)
    public UserResponseDTO findUserByEmailAndConvert(String email) {
        return convertToDTO(findUserByEmail(email));
    }

    // ---------------------------- CREATE ----------------------------

    @Transactional
    public UserResponseDTO saveUser(NewUserDTO payload) {
        userRepository.findByEmail(payload.email()).ifPresent(u -> {
            throw new DuplicateResourceException("L'email " + u.getEmail() + " appartiene già ad un altro utente");
        });

        userRepository.findByPhone(payload.phone()).ifPresent(u -> {
            throw new DuplicateResourceException("Il numero di telefono " + u.getPhone() + " appartiene già ad un altro utente");
        });

        User newUser = new User(
                payload.name(),
                payload.surname(),
                payload.email(),
                bcrypt.encode(payload.password()),
                payload.phone()
        );

        User saved = userRepository.save(newUser);
        log.info("✅ Utente '{}' (email: {}) creato correttamente", saved.getName(), saved.getEmail());
        return convertToDTO(saved);
    }

    // ---------------------------- UPDATE PROFILE ----------------------------

    @Transactional
    public UserResponseDTO updateUserProfile(UUID idUser, UpdateUserDTO payload) {
        User found = findUserById(idUser);

        if (!found.getEmail().equals(payload.email())) {
            userRepository.findByEmail(payload.email()).ifPresent(u -> {
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
        found.setEmail(payload.email());
        found.setPhone(payload.phone());

        User updated = userRepository.save(found);
        log.info("✏️  Profilo utente '{}' aggiornato con successo", updated.getEmail());
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

        log.info("🔐 Password aggiornata per l'utente '{}'", updated.getEmail());
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

        log.info("⬆️  Utente '{}' promosso a ADMIN", updated.getEmail());
        return convertToDTO(updated);
    }

    @Transactional
    public UserResponseDTO revokeAdmin(UUID idUser) {
        User found = findUserById(idUser);

        if (found.getRole() == Role.COSTUMER)
            throw new UnauthorizedOperationException("L'utente è già COSTUMER.");

        found.setRole(Role.COSTUMER);
        User updated = userRepository.save(found);

        log.info("⬇️  Utente '{}' retrocesso a COSTUMER", updated.getEmail());
        return convertToDTO(updated);
    }

    // ---------------------------- DELETE ----------------------------

    @Transactional
    public void deleteUser(UUID idUser) {
        User found = findUserById(idUser);
        userRepository.delete(found);
        log.info("🗑️  Utente '{}' eliminato correttamente", found.getEmail());
    }

    // ---------------------------- CONVERTER ----------------------------
    private UserResponseDTO convertToDTO(User user) {
        return new UserResponseDTO(
                user.getUserId(),
                user.getName(),
                user.getSurname(),
                user.getEmail(),
                user.getPhone(),
                user.getRole()
        );
    }
}