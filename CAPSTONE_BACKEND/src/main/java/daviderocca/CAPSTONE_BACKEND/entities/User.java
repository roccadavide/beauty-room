package daviderocca.CAPSTONE_BACKEND.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import daviderocca.CAPSTONE_BACKEND.enums.Role;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "users")
@NoArgsConstructor
@Getter
@Setter
@ToString(exclude = {"bookings", "password"})
@JsonIgnoreProperties({
        "authorities",
        "enabled",
        "accountNonExpired",
        "credentialsNonExpired",
        "accountNonLocked"
})
public class User implements UserDetails {

    // Primary Key
    @Id
    @GeneratedValue
    @Setter(AccessLevel.NONE)
    @Column(name = "user_id", updatable = false, nullable = false)
    private UUID userId;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Column(name = "surname", nullable = false, length = 50)
    private String surname;

    @Column(name = "email", nullable = false, unique = true, length = 100)
    @ToString.Include
    private String email;

    @Column(name = "password", nullable = false)
    @JsonIgnore
    private String password;

    @Column(name = "phone", nullable = false, length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 30)
    private Role role = Role.COSTUMER;

    // Relazioni
    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Booking> bookings;

    // Costruttore personalizzato
    public User(String name, String surname, String email, String password, String phone) {
        this.name = name;
        this.surname = surname;
        this.email = email;
        this.password = password;
        this.phone = phone;
    }

    // Spring Security - Ruoli
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + this.role.name()));
    }

    // Email come username
    @Override
    public String getUsername() {
        return this.email;
    }

    // Account status (Spring Security)
    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}