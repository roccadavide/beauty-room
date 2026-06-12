package daviderocca.beautyroom;

import daviderocca.beautyroom.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.SettlementRequestDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.BookingSale;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.Role;
import daviderocca.beautyroom.packages.BookingPackageLinkRepository;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentRepository;
import daviderocca.beautyroom.promotions.BookingPromotionLinkRepository;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.BookingSaleRepository;
import daviderocca.beautyroom.services.BookingService;
import daviderocca.beautyroom.services.PackageCreditService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Focused unit tests for {@link BookingService#settleBookingLines} (V64 completion drawer).
 * Pure Mockito (mirrors {@code BookingServiceTest}). entityManager is mocked because
 * the per-line / bulk booking_services UPDATE has no JPA entity and is driven natively.
 */
@ExtendWith(MockitoExtension.class)
class BookingServiceSettlementTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private PackageCreditService packageCreditService;
    @Mock private BookingPackageLinkRepository bookingPackageLinkRepository;
    // 08.2 added setAllPromotionLinksPaid(...) to the bundle/mark-all settle branches;
    // @InjectMocks would otherwise leave this null → NPE in those two tests (08.2b).
    @Mock private BookingPromotionLinkRepository bookingPromotionLinkRepository;
    // M3-3: settleBookingLines now consumes salePaid → flips standalone booking_sales.paid.
    @Mock private BookingSaleRepository bookingSaleRepository;
    @Mock private EntityManager entityManager;
    // Fix 14: BookingService now constructor-injects this. Settlement paths never hit
    // the overlap check, but @InjectMocks would pass null without a matching @Mock.
    @Mock private PersonalAppointmentRepository personalAppointmentRepository;

    @InjectMocks private BookingService bookingService;

    // @InjectMocks uses constructor injection and does NOT field-inject the
    // @PersistenceContext EntityManager — wire it in by hand.
    @BeforeEach
    void wireEntityManager() {
        setFieldReflectively(bookingService, "entityManager", entityManager);
    }

    private static User admin() {
        User admin = new User("Admin", "Test", "admin@test.it", "pwd", "000");
        admin.setRole(Role.ADMIN);
        return admin;
    }

    private Booking newBooking(UUID id, BookingStatus status) {
        Booking b = new Booking();
        setFieldReflectively(b, "bookingId", id);
        b.setBookingStatus(status);
        b.setServices(new ArrayList<>()); // convertToDTO streams this; never null
        return b;
    }

    /** Stub the native UPDATE chain and capture the SQL strings issued. */
    private Query stubNativeQuery() {
        Query q = mock(Query.class);
        when(entityManager.createNativeQuery(anyString())).thenReturn(q);
        when(q.setParameter(anyString(), any())).thenReturn(q);
        return q;
    }

    // =========================================================================
    // (a) Normal: custom_total_price == null → per-line payload is honoured.
    // =========================================================================
    @Test
    @DisplayName("settleBookingLines — (a) non-bundle: per-line servicePaid is honoured")
    void settle_perLine_nonBundle() {
        UUID id = UUID.randomUUID();
        UUID svcA = UUID.randomUUID();
        UUID svcB = UUID.randomUUID();
        Booking booking = newBooking(id, BookingStatus.CONFIRMED); // customTotalPrice = null
        when(bookingRepository.findByIdForUpdate(id)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        stubNativeQuery();

        Map<UUID, Boolean> servicePaid = new LinkedHashMap<>();
        servicePaid.put(svcA, true);
        servicePaid.put(svcB, false);
        SettlementRequestDTO req = new SettlementRequestDTO(null, servicePaid, null, null, false, null, null);

        BookingResponseDTO res = bookingService.settleBookingLines(id, req, admin());

        // Two per-line UPDATEs, each targeting a specific service_id (not the bulk form).
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(entityManager, times(2)).createNativeQuery(sql.capture());
        assertThat(sql.getAllValues()).allMatch(s -> s.contains("service_id ="));
        // No completion requested → status untouched, no session consumed.
        assertThat(res.bookingStatus()).isEqualTo(BookingStatus.CONFIRMED);
        verify(packageCreditService, never()).consumeSessionForBooking(any());
    }

    // =========================================================================
    // (b) Bundle: custom_total_price != null → per-line payload IGNORED (lockstep).
    // =========================================================================
    @Test
    @DisplayName("settleBookingLines — (b) bundle: mixed per-line payload is ignored, all lines move together")
    void settle_bundle_forcesLockstep() {
        UUID id = UUID.randomUUID();
        UUID svcA = UUID.randomUUID();
        UUID svcB = UUID.randomUUID();
        Booking booking = newBooking(id, BookingStatus.CONFIRMED);
        booking.setCustomTotalPrice(new BigDecimal("80.00")); // bundle
        booking.setCustomService(true);
        booking.setCustomServicePaid(false);
        when(bookingRepository.findByIdForUpdate(id)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(bookingPackageLinkRepository.findAllByBookingBookingIdWithAssignment(id)).thenReturn(List.of());
        stubNativeQuery();

        // Mixed payload: svcA=true (first → derived bundle value), svcB=false (must be ignored).
        Map<UUID, Boolean> servicePaid = new LinkedHashMap<>();
        servicePaid.put(svcA, true);
        servicePaid.put(svcB, false);
        SettlementRequestDTO req = new SettlementRequestDTO(null, servicePaid, null, null, false, null, null);

        bookingService.settleBookingLines(id, req, admin());

        // Only the BULK UPDATE (no service_id predicate) is issued — never the per-line form.
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(entityManager, atLeastOnce()).createNativeQuery(sql.capture());
        assertThat(sql.getAllValues()).noneMatch(s -> s.contains("service_id ="));
        // Everything flipped to the single derived value (true), regardless of svcB=false.
        assertThat(booking.isCustomServicePaid()).isTrue();
        verify(packageCreditService, never()).consumeSessionForBooking(any());
    }

    // =========================================================================
    // (c) alsoComplete is idempotent: re-completing does not double up side-effects.
    // =========================================================================
    @Test
    @DisplayName("settleBookingLines — (c) alsoComplete is idempotent on re-run")
    void settle_alsoComplete_isIdempotent() {
        UUID id = UUID.randomUUID();
        Booking booking = newBooking(id, BookingStatus.CONFIRMED);
        when(bookingRepository.findByIdForUpdate(id)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(bookingPackageLinkRepository.findAllByBookingBookingIdWithAssignment(id)).thenReturn(List.of());
        stubNativeQuery();

        SettlementRequestDTO req = new SettlementRequestDTO(Boolean.TRUE, null, null, null, true, null, null);

        // First settle: CONFIRMED → COMPLETED, consumes one session, stamps completedAt.
        BookingResponseDTO r1 = bookingService.settleBookingLines(id, req, admin());
        assertThat(r1.bookingStatus()).isEqualTo(BookingStatus.COMPLETED);
        LocalDateTime firstCompletedAt = booking.getCompletedAt();
        assertThat(firstCompletedAt).isNotNull();

        // Second settle on an already-COMPLETED booking: no re-consume, completedAt preserved.
        BookingResponseDTO r2 = bookingService.settleBookingLines(id, req, admin());
        assertThat(r2.bookingStatus()).isEqualTo(BookingStatus.COMPLETED);
        assertThat(booking.getCompletedAt()).isEqualTo(firstCompletedAt);

        verify(packageCreditService, times(1)).consumeSessionForBooking(any());
        verify(packageCreditService, never()).restoreSessionForBooking(any());
    }

    // =========================================================================
    // (d) Bug3 — legacy principal: a single-service booking whose principal is only
    // on bookings.service_id (NO booking_services row, count == 0) routes the per-line
    // toggle to bookings.paid_in_store instead of a no-op UPDATE.
    // =========================================================================
    @Test
    @DisplayName("settleBookingLines — (d) legacy principal (no booking_services row) settles paid_in_store")
    void settle_legacyPrincipal_setsPaidInStore() {
        UUID id = UUID.randomUUID();
        UUID principalSvcId = UUID.randomUUID();
        Booking booking = newBooking(id, BookingStatus.CONFIRMED); // customTotalPrice = null, not custom
        ServiceItem principal = new ServiceItem();
        setFieldReflectively(principal, "serviceId", principalSvcId);
        booking.setService(principal);
        assertThat(booking.isPaidInStore()).isFalse();

        when(bookingRepository.findByIdForUpdate(id)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        Query q = stubNativeQuery();
        when(q.getSingleResult()).thenReturn(0L); // count(booking_services) == 0 → legacy principal

        Map<UUID, Boolean> servicePaid = new LinkedHashMap<>();
        servicePaid.put(principalSvcId, true); // frontend legacy fallback keys by booking.serviceId
        SettlementRequestDTO req = new SettlementRequestDTO(null, servicePaid, null, null, false, null, null);

        bookingService.settleBookingLines(id, req, admin());

        // The no-op booking_services UPDATE is replaced by routing the flag to paid_in_store.
        assertThat(booking.isPaidInStore()).isTrue();
    }

    // =========================================================================
    // (e)/(f)/(g) Block B (M3-3) — salePaid flips standalone booking_sales.paid,
    // independently of markAllPaid, never touching promo-linked sales.
    // =========================================================================
    @Test
    @DisplayName("settleBookingLines — (e) salePaid flips a standalone product sale")
    void settle_salePaid_flipsStandaloneSale() {
        UUID id = UUID.randomUUID();
        UUID saleId = UUID.randomUUID();
        Booking booking = newBooking(id, BookingStatus.CONFIRMED); // non-bundle
        BookingSale sale = newSale(saleId, id, null, false);       // standalone, unpaid
        when(bookingRepository.findByIdForUpdate(id)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(id)).thenReturn(List.of(sale));

        Map<UUID, Boolean> salePaid = new LinkedHashMap<>();
        salePaid.put(saleId, true);
        SettlementRequestDTO req = new SettlementRequestDTO(null, null, null, null, false, null, salePaid);

        bookingService.settleBookingLines(id, req, admin());

        assertThat(sale.isPaid()).isTrue();
        verify(bookingSaleRepository).save(sale);
    }

    @Test
    @DisplayName("settleBookingLines — (f) salePaid ignores promo-linked sales (guard holds)")
    void settle_salePaid_ignoresPromoLinkedSale() {
        UUID id = UUID.randomUUID();
        UUID saleId = UUID.randomUUID();
        Booking booking = newBooking(id, BookingStatus.CONFIRMED);
        BookingSale promoSale = newSale(saleId, id, UUID.randomUUID(), false); // promo-linked
        when(bookingRepository.findByIdForUpdate(id)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(id)).thenReturn(List.of(promoSale));

        Map<UUID, Boolean> salePaid = new LinkedHashMap<>();
        salePaid.put(saleId, true);
        SettlementRequestDTO req = new SettlementRequestDTO(null, null, null, null, false, null, salePaid);

        bookingService.settleBookingLines(id, req, admin());

        // The standalone guard (promotionLinkId == null) skips it — settled via promotionPaid.
        assertThat(promoSale.isPaid()).isFalse();
        verify(bookingSaleRepository, never()).save(any());
    }

    @Test
    @DisplayName("settleBookingLines — (g) markAllPaid (no salePaid) never touches product sales")
    void settle_markAllPaid_leavesProductsAlone() {
        UUID id = UUID.randomUUID();
        Booking booking = newBooking(id, BookingStatus.CONFIRMED);
        when(bookingRepository.findByIdForUpdate(id)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(bookingPackageLinkRepository.findAllByBookingBookingIdWithAssignment(id)).thenReturn(List.of());
        stubNativeQuery();

        // Bulk mark-all, salePaid intentionally null (7th arg).
        SettlementRequestDTO req = new SettlementRequestDTO(Boolean.TRUE, null, null, null, false, null, null);

        bookingService.settleBookingLines(id, req, admin());

        // The bundle/mark-all path settles services/packages/promos/custom only — products
        // (booking_sales) are settled exclusively via salePaid, so they are never SAVED here.
        // (The response mapping may READ sales to render them, which is not a settlement.)
        verify(bookingSaleRepository, never()).save(any());
    }

    /** A BookingSale fixture: promotionLinkId == null → standalone (settled via salePaid). */
    private BookingSale newSale(UUID saleId, UUID bookingId, UUID promotionLinkId, boolean paid) {
        BookingSale s = new BookingSale();
        setFieldReflectively(s, "id", saleId);
        s.setBookingId(bookingId);
        s.setPromotionLinkId(promotionLinkId);
        s.setPaid(paid);
        return s;
    }

    // Reflective setter for private ids (mirrors BookingServiceTest).
    private static void setFieldReflectively(Object target, String fieldName, Object value) {
        try {
            var field = findField(target.getClass(), fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException("setFieldReflectively failed for " + fieldName, e);
        }
    }

    private static java.lang.reflect.Field findField(Class<?> clazz, String name) {
        while (clazz != null) {
            try {
                return clazz.getDeclaredField(name);
            } catch (NoSuchFieldException e) {
                clazz = clazz.getSuperclass();
            }
        }
        throw new RuntimeException("Campo non trovato: " + name);
    }
}
