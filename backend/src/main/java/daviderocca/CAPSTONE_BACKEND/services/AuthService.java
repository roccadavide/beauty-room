package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.userDTOs.UserLoginDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.exceptions.UnauthorizedException;
import daviderocca.CAPSTONE_BACKEND.tools.JWTTools;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;
    private final JWTTools jwtTools;
    private final PasswordEncoder bcrypt;

    public User checkAccessAndGetUser(UserLoginDTO body) {
        User found = userService.findUserByEmail(body.email());
        if (bcrypt.matches(body.password(), found.getPassword())) {
            return found;
        } else {
            throw new UnauthorizedException("Password errata");
        }
    }

    public String checkAccessAndGenerateToken(UserLoginDTO body) {
        User found = checkAccessAndGetUser(body);
        return jwtTools.createTokenUser(found);
    }
}
