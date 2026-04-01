package daviderocca.beautyroom.repositories;

import daviderocca.beautyroom.DTO.reportDTOs.PeriodSummaryDTO;
import daviderocca.beautyroom.DTO.reportDTOs.ServiceRevenueDTO;
import daviderocca.beautyroom.DTO.reportDTOs.TopClientDTO;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.OrderStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Repository
public class ReportRepository {

    @PersistenceContext
    private EntityManager em;

    public List<Object[]> monthlyTreatmentRevenue(LocalDateTime from, LocalDateTime to) {
        return em.createQuery("""
                        SELECT YEAR(b.startTime), MONTH(b.startTime),
                               SUM(COALESCE(so.price, s.price))
                        FROM Booking b
                        JOIN b.service s
                        LEFT JOIN b.serviceOption so
                        WHERE b.bookingStatus = :status
                          AND b.startTime >= :from
                          AND b.startTime < :to
                        GROUP BY YEAR(b.startTime), MONTH(b.startTime)
                        ORDER BY YEAR(b.startTime), MONTH(b.startTime)
                        """, Object[].class)
                .setParameter("status", BookingStatus.COMPLETED)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
    }

    public List<Object[]> monthlyProductRevenue(LocalDateTime from, LocalDateTime to) {
        return em.createQuery("""
                        SELECT YEAR(o.paidAt), MONTH(o.paidAt),
                               SUM(oi.price * oi.quantity)
                        FROM Order o JOIN o.orderItems oi
                        WHERE o.orderStatus = :status
                          AND o.paidAt >= :from
                          AND o.paidAt < :to
                        GROUP BY YEAR(o.paidAt), MONTH(o.paidAt)
                        ORDER BY YEAR(o.paidAt), MONTH(o.paidAt)
                        """, Object[].class)
                .setParameter("status", OrderStatus.PAID_PENDING_PICKUP)
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
    }

    public List<ServiceRevenueDTO> topServices(LocalDateTime from, LocalDateTime to) {
        List<Object[]> rows = em.createQuery("""
                        SELECT b.service.title,
                               COUNT(b),
                               SUM(COALESCE(so.price, s.price))
                        FROM Booking b
                        JOIN b.service s
                        LEFT JOIN b.serviceOption so
                        WHERE b.bookingStatus = :status
                          AND b.startTime >= :from
                          AND b.startTime < :to
                        GROUP BY b.service.title
                        ORDER BY COUNT(b) DESC
                        """, Object[].class)
                .setParameter("status", BookingStatus.COMPLETED)
                .setParameter("from", from)
                .setParameter("to", to)
                .setMaxResults(10)
                .getResultList();

        List<ServiceRevenueDTO> result = new ArrayList<>();
        for (Object[] r : rows) {
            String title = (String) r[0];
            long count = (Long) r[1];
            BigDecimal revenue = (BigDecimal) r[2];
            result.add(new ServiceRevenueDTO(title, count, revenue != null ? revenue : BigDecimal.ZERO));
        }
        return result;
    }

    public List<TopClientDTO> topClients(LocalDateTime from, LocalDateTime to) {
        List<Object[]> rows = em.createQuery("""
                        SELECT b.customerName, b.customerPhone,
                               COUNT(b),
                               SUM(CASE WHEN b.bookingStatus = 'COMPLETED' THEN 1 ELSE 0 END),
                               MAX(b.startTime)
                        FROM Booking b
                        WHERE b.bookingStatus <> daviderocca.beautyroom.enums.BookingStatus.PENDING_PAYMENT
                          AND b.startTime >= :from
                          AND b.startTime < :to
                        GROUP BY b.customerName, b.customerPhone
                        ORDER BY COUNT(b) DESC
                        """, Object[].class)
                .setParameter("from", from)
                .setParameter("to", to)
                .setMaxResults(10)
                .getResultList();

        List<TopClientDTO> result = new ArrayList<>();
        for (Object[] r : rows) {
            String name = (String) r[0];
            String phone = (String) r[1];
            long totalBookings = (Long) r[2];
            long completedBookings = ((Number) r[3]).longValue();
            LocalDateTime lastAt = (LocalDateTime) r[4];
            result.add(new TopClientDTO(name, phone, totalBookings, completedBookings, lastAt));
        }
        return result;
    }

    public PeriodSummaryDTO periodSummary(LocalDateTime from, LocalDateTime to) {
        BigDecimal treatments = (BigDecimal) em.createQuery("""
                        SELECT COALESCE(SUM(COALESCE(so.price, s.price)), 0)
                        FROM Booking b
                        JOIN b.service s
                        LEFT JOIN b.serviceOption so
                        WHERE b.bookingStatus = :status
                          AND b.startTime >= :from
                          AND b.startTime < :to
                        """)
                .setParameter("status", BookingStatus.COMPLETED)
                .setParameter("from", from)
                .setParameter("to", to)
                .getSingleResult();

        BigDecimal products = (BigDecimal) em.createQuery("""
                        SELECT COALESCE(SUM(oi.price * oi.quantity), 0)
                        FROM Order o JOIN o.orderItems oi
                        WHERE o.orderStatus = :status
                          AND o.paidAt >= :from
                          AND o.paidAt < :to
                        """)
                .setParameter("status", OrderStatus.PAID_PENDING_PICKUP)
                .setParameter("from", from)
                .setParameter("to", to)
                .getSingleResult();

        long completed = (Long) em.createQuery("""
                        SELECT COUNT(b)
                        FROM Booking b
                        WHERE b.bookingStatus = :status
                          AND b.startTime >= :from
                          AND b.startTime < :to
                        """)
                .setParameter("status", BookingStatus.COMPLETED)
                .setParameter("from", from)
                .setParameter("to", to)
                .getSingleResult();

        long cancelled = (Long) em.createQuery("""
                        SELECT COUNT(b)
                        FROM Booking b
                        WHERE b.bookingStatus IN (:c1, :c2)
                          AND b.startTime >= :from
                          AND b.startTime < :to
                        """)
                .setParameter("c1", BookingStatus.CANCELLED)
                .setParameter("c2", BookingStatus.NO_SHOW)
                .setParameter("from", from)
                .setParameter("to", to)
                .getSingleResult();

        long newClients = (Long) em.createQuery("""
                        SELECT COUNT(DISTINCT b.customerEmail)
                        FROM Booking b
                        WHERE b.customerEmail IS NOT NULL
                          AND b.startTime >= :from
                          AND b.startTime < :to
                          AND b.startTime = (
                              SELECT MIN(b2.startTime)
                              FROM Booking b2
                              WHERE b2.customerEmail = b.customerEmail
                          )
                        """)
                .setParameter("from", from)
                .setParameter("to", to)
                .getSingleResult();

        BigDecimal total = treatments.add(products);

        return new PeriodSummaryDTO(
                total,
                treatments,
                products,
                completed,
                cancelled,
                newClients
        );
    }
}

