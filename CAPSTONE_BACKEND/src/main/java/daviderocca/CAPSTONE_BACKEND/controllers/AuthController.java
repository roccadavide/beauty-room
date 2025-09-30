package daviderocca.CAPSTONE_BACKEND.controllers;

import daviderocca.CAPSTONE_BACKEND.DTO.LoginUserRespDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewUserDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.UserLoginDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.UserResponseDTO;
import daviderocca.CAPSTONE_BACKEND.exceptions.ValidationException;
import daviderocca.CAPSTONE_BACKEND.services.AuthService;
import daviderocca.CAPSTONE_BACKEND.services.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.validation.BindingResult;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/noAuth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserService userService;

    @PostMapping("/login")
    public LoginUserRespDTO loginUserRespDTO(@RequestBody UserLoginDTO body) {
        String token = authService.checkAccessAndGenerateToken(body);
        return new LoginUserRespDTO(token);
    }

    @PostMapping("/registerAdmin")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponseDTO createUser(@RequestBody @Validated NewUserDTO body, BindingResult validationResult) {
        if (validationResult.hasErrors()) {
            throw new ValidationException(validationResult.getFieldErrors()
                    .stream().map(fieldError -> fieldError.getDefaultMessage()).toList());
        } else {
            return this.userService.saveUser(body);
        }
    }

    @PatchMapping("/{idUser}/addRole")
    public void findUserByAndPatchRole(@PathVariable UUID idUser) {
        this.userService.findUserByIdAndPatchToAdmin(idUser);
    }
}
