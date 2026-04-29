package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);

    @Query("SELECT u FROM User u WHERE LOWER(TRIM(CONCAT(u.name, ' ', u.surname))) = :fullName")
    List<User> findAllByFullNameIgnoreCase(@Param("fullName") String fullName);

}
