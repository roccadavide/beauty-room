package daviderocca.beautyroom.security;

import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {
    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return userRepository.findByEmail(email)
                .map(u -> (User) u) // il tuo User implementa UserDetails
                .orElseThrow(() -> new UsernameNotFoundException("Utente non trovato: " + email));
    }
}
