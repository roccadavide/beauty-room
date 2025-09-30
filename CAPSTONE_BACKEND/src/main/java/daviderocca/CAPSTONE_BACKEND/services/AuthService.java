package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.UserLoginDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.exceptions.UnauthorizedException;
import daviderocca.CAPSTONE_BACKEND.tools.JWTTools;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

        @Autowired
        private UserService userService;

        @Autowired
        private JWTTools jwtTools;

        @Autowired
        private PasswordEncoder bcrypt;

        public String checkAccessAndGenerateToken(UserLoginDTO body) {
            User found = this.userService.findUserByEmail(body.email());
            if (bcrypt.matches(body.password(), found.getPassword())) {
                return jwtTools.createTokenUser(found);
            } else {
                throw new UnauthorizedException("Password errata");
            }
        }
}
