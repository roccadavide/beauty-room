package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.NewPasswordDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewUserDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.UpdateUserDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.UserResponseDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.Role;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.DuplicateResourceException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.exceptions.UnauthorizedOperationException;
import daviderocca.CAPSTONE_BACKEND.repositories.UserRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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

    public Page<UserResponseDTO> findAllUsers(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<User> page = this.userRepository.findAll(pageable);

        return page.map(user -> new UserResponseDTO(
                user.getUserId(),
                user.getName(),
                user.getSurname(),
                user.getEmail(),
                user.getPhone(),
                user.getRole()));
    }

    public User findUserById(UUID userId) {
        return this.userRepository.findById(userId).orElseThrow(()-> new ResourceNotFoundException(userId));
    }

    public UserResponseDTO findUserByIdAndConvert(UUID userId) {
        User found = this.userRepository.findById(userId).orElseThrow(()-> new ResourceNotFoundException(userId));

        return new UserResponseDTO(
                found.getUserId(),
                found.getName(),
                found.getSurname(),
                found.getEmail(),
                found.getPhone(),
                found.getRole());
    }

    public User findUserByEmail(String email) {
        return this.userRepository.findByEmail(email).orElseThrow(()-> new ResourceNotFoundException(email));
    }

    public UserResponseDTO findUserByEmailAndConvert(String email) {
        User found = this.userRepository.findByEmail(email).orElseThrow(()-> new ResourceNotFoundException(email));

        return new UserResponseDTO(
                found.getUserId(),
                found.getName(),
                found.getSurname(),
                found.getEmail(),
                found.getPhone(),
                found.getRole());
    }

    public UserResponseDTO saveUser(NewUserDTO payload) {
        this.userRepository.findByEmail(payload.email()).ifPresent(user -> {
            throw new DuplicateResourceException("L'email " + user.getEmail() + " appartiene già ad un'altro user");
        });

        this.userRepository.findByPhone(payload.phone()).ifPresent(user -> {
                    throw new DuplicateResourceException("Il numero di telefono " + user.getPhone() + " appartiene già ad un'altro user");
                });

        User newUser =  new User(payload.name(), payload.surname(), payload.email(), bcrypt.encode(payload.password()), payload.phone());
        User savedNewUser = this.userRepository.save(newUser);
        log.info("L'Utente {} con email {} è stato salvato correttamente!", payload.name(), payload.email());
        return new UserResponseDTO(savedNewUser.getUserId(), savedNewUser.getName(), savedNewUser.getSurname(), savedNewUser.getEmail(),
                savedNewUser.getPhone(), savedNewUser.getRole());
    }

    @Transactional
    public UserResponseDTO findUserByIdAndUpdateProfile (UUID idUser, UpdateUserDTO payload) {
        User found = findUserById(idUser);

        if (!found.getEmail().equals(payload.email()))
            this.userRepository.findByEmail(payload.email()).ifPresent(user -> {
                throw new DuplicateResourceException("L'email " + user.getEmail() + " appartiene già ad un'altro user");
            });

        if (!found.getPhone().equals(payload.phone()))
            this.userRepository.findByPhone(payload.phone()).ifPresent(user -> {
                throw new DuplicateResourceException("Il numero di telefono " + user.getPhone() + " appartiene già ad un'altro user");
            });


        found.setName(payload.name());
        found.setSurname(payload.surname());
        found.setEmail(payload.email());
        found.setPhone(payload.phone());

        User modifiedUser = this.userRepository.save(found);
        log.info("User modificato correttamente");
        return new UserResponseDTO(modifiedUser.getUserId(), modifiedUser.getName(), modifiedUser.getSurname(), modifiedUser.getEmail(),
                modifiedUser.getPhone(), modifiedUser.getRole());
    }

    @Transactional
    public UserResponseDTO findUserByIdAndPatchPassword (UUID idUser, NewPasswordDTO payload) {
        User found = findUserById(idUser);

        if (!bcrypt.matches(payload.oldPassword(), found.getPassword())) {
            throw new BadRequestException("La password inserita è errata!");
        }

        if (bcrypt.matches(payload.newPassword(), found.getPassword())) {
            throw new BadRequestException("La nuova password non può coincidere con quella vecchia.");
        }

        if (!payload.newPassword().equals(payload.confirmNewPassword())) {
            throw new BadRequestException("La nuova password e la conferma non coincidono.");
        }

        found.setPassword(bcrypt.encode(payload.newPassword()));

        User modifiedUser = this.userRepository.save(found);
        log.info("Password dell'user con email {} modificata correttamente!", modifiedUser.getEmail());

        return new UserResponseDTO(modifiedUser.getUserId(), modifiedUser.getName(), modifiedUser.getSurname(), modifiedUser.getEmail(),
                modifiedUser.getPhone(), modifiedUser.getRole());
    }

    @Transactional
    public UserResponseDTO findUserByIdAndPatchToAdmin (UUID idUser) {
        User found = findUserById(idUser);

        if(found.getRole().equals(Role.ADMIN)) throw new UnauthorizedOperationException("L'Utente è gia ADMIN!");

        found.setRole(Role.ADMIN);

        User modifiedUser = userRepository.save(found);

        return new UserResponseDTO(modifiedUser.getUserId(), modifiedUser.getName(), modifiedUser.getSurname(), modifiedUser.getEmail(),
                modifiedUser.getPhone(), modifiedUser.getRole());
    }

    @Transactional
    public UserResponseDTO findUserByIdAndRemoveFromAdmin (UUID idUser) {
        User found = findUserById(idUser);

        if(found.getRole().equals(Role.COSTUMER)) throw new UnauthorizedOperationException("L'Utente è gia COSTUMER!");

        found.setRole(Role.COSTUMER);

        User modifiedUser = userRepository.save(found);

        return new UserResponseDTO(modifiedUser.getUserId(), modifiedUser.getName(), modifiedUser.getSurname(), modifiedUser.getEmail(),
                modifiedUser.getPhone(), modifiedUser.getRole());
    }

    @Transactional
    public void findUserByIdAndDelete(UUID idUser) {
        User found = findUserById(idUser);
        this.userRepository.delete(found);
    }

}
