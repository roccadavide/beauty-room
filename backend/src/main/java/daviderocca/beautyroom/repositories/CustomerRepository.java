package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.Customer;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    @Query("""
        SELECT c FROM Customer c
        WHERE lower(c.fullName) LIKE lower(concat('%', :q, '%'))
           OR c.phone            LIKE        concat('%', :q, '%')
           OR lower(c.email)     LIKE lower(concat('%', :q, '%'))
        ORDER BY c.fullName ASC
        """)
    List<Customer> searchByQuery(@Param("q") String q, Pageable pageable);

    /** Used as primary deduplication key during findOrCreate. */
    Optional<Customer> findByPhone(String phone);

    /** Secondary deduplication key for registered (non-walk-in) customers. */
    Optional<Customer> findByEmail(String email);
}