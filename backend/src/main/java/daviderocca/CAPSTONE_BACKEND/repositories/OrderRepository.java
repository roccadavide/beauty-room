package daviderocca.CAPSTONE_BACKEND.repositories;

import daviderocca.CAPSTONE_BACKEND.entities.Order;
import daviderocca.CAPSTONE_BACKEND.enums.OrderStatus;
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
}