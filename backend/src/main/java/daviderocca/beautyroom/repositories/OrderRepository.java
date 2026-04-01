package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.entities.Order;
import daviderocca.beautyroom.enums.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {

    List<Order> findByCustomerEmail(String customerEmail);

    List<Order> findByUser_UserId(UUID userId);

    List<Order> findByOrderStatusAndExpiresAtBefore(OrderStatus status, LocalDateTime time);

    @Query("""
    SELECT DISTINCT o
    FROM Order o
    LEFT JOIN FETCH o.orderItems oi
    LEFT JOIN FETCH oi.product p
    WHERE o.orderId = :id
""")
    Optional<Order> findByIdWithItems(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"orderItems", "user"})
    @Query("select o from Order o")
    Page<Order> findAllWithDetails(Pageable pageable);

    @EntityGraph(attributePaths = {"orderItems", "user"})
    @Query("select o from Order o where o.user.userId = :userId")
    List<Order> findByUser_UserIdWithDetails(@Param("userId") UUID userId);
}