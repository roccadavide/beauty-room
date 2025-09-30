package daviderocca.CAPSTONE_BACKEND;

import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.Role;
import daviderocca.CAPSTONE_BACKEND.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class AdminInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder bcrypt;

    @Value("${admin.nome}")
    private String adminName;
    @Value("${admin.cognome}")
    private String adminSurname;
    @Value("${admin.email}")
    private String adminEmail;
    @Value("${admin.password}")
    private String adminPassword;
    @Value("${admin.phone}")
    private String adminPhone;

    @Override
    public void run(String... args) throws Exception {
        if (userRepository.findByEmail(adminEmail).isEmpty()) {
            User admin = new User();
            admin.setName(adminName);
            admin.setSurname(adminSurname);
            admin.setEmail(adminEmail);
            admin.setPassword(bcrypt.encode(adminPassword));
            admin.setPhone(adminPhone);
            admin.setRole(Role.ADMIN);
            userRepository.save(admin);

            System.out.println("✅ Admin creato con successo: " + adminEmail);
            System.out.println("   Nome: " + adminName + " " + adminSurname);
        } else {
            System.out.println("❌ L'utente admin esiste già!");
        }
    }
}

