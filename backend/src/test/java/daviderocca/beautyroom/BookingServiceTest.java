package daviderocca.beautyroom;

import daviderocca.beautyroom.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.AdminBookingCreateDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.SaleEntryDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.BookingSale;
import daviderocca.beautyroom.entities.Customer;
import daviderocca.beautyroom.entities.Product;
import daviderocca.beautyroom.entities.PackageCredit;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.ServiceOption;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.NotificationType;
import daviderocca.beautyroom.enums.Role;
import daviderocca.beautyroom.packages.BookingPackageLink;
import daviderocca.beautyroom.packages.BookingPackageLinkRepository;
import daviderocca.beautyroom.packages.ClientPackageAssignment;
import daviderocca.beautyroom.personalappointments.PersonalAppointment;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentRepository;
import daviderocca.beautyroom.promotions.BookingPromotionLinkRepository;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.BookingSaleRepository;
import daviderocca.beautyroom.repositories.ProductRepository;
import daviderocca.beautyroom.repositories.ServiceOptionRepository;
import daviderocca.beautyroom.services.AdminNotificationService;
import daviderocca.beautyroom.services.BookingService;
import daviderocca.beautyroom.packages.ClientPackageService;
import daviderocca.beautyroom.packages.PackageInstallmentService;
import daviderocca.beautyroom.services.CustomerService;
import daviderocca.beautyroom.services.PackageCreditService;
import daviderocca.beautyroom.services.ServiceItemService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private ServiceItemService serviceItemService;
    @Mock
    private ServiceOptionRepository serviceOptionRepository;
    @Mock
    private PackageCreditService packageCreditService;
    @Mock
    private CustomerService customerService;
    @Mock
    private BookingPackageLinkRepository bookingPackageLinkRepository;
    @Mock
    private ClientPackageService clientPackageService;
    // Phase 5d: createMultiServiceBooking now snaps date-less installments via
    // PackageInstallmentService. No existing test calls that method, so the mock is
    // never invoked (no stubbing) — it exists only so @InjectMocks wires a non-null dep.
    @Mock
    private PackageInstallmentService packageInstallmentService;
    // Added as a final dependency of BookingService by the closure feature work
    // (commits before Phase 6e). Without mocking it createManualBooking ... NPEs
    // on closureService.assertNoOverlappingClosure(...). Pure test-infra fix.
    @Mock
    private daviderocca.beautyroom.services.ClosureService closureService;
    // Added as a final dependency of BookingService by the email-feature merge.
    // Without this mock @InjectMocks injects null and the fire-and-forget email
    // calls NPE — the 3 pre-existing BookingServiceTest failures. The calls are
    // void, so Mockito's default no-op is correct; no stubbing needed.
    @Mock
    private daviderocca.beautyroom.email.outbox.EmailOutboxService emailOutboxService;
    @Mock
    private BookingSaleRepository bookingSaleRepository;
    @Mock
    private ProductRepository productRepository;
    // Fix 3: createOnlineProductSales notifies the admin on missing-product / short-stock. BookingService
    // declares it as a final dep; without this mock @InjectMocks injects null and the notify path NPEs.
    @Mock
    private AdminNotificationService notificationService;
    // BE-5: hardDeleteBooking touches these two — promo-artifact cleanup + the JPQL package-link delete.
    @Mock
    private BookingPromotionLinkRepository bookingPromotionLinkRepository;
    @Mock
    private EntityManager entityManager;
    // Fix 14: shared overlap check now also queries personal_appointments. Without this
    // mock @InjectMocks injects null and every create/reschedule path NPEs; default mock
    // returns an empty list, so existing tests see no phantom personal time.
    @Mock
    private PersonalAppointmentRepository personalAppointmentRepository;

    @InjectMocks
    private BookingService bookingService;

    // =========================================================================
    // TC-B1: V72 — completing an online-package booking is counter-neutral.
    // The session is consumed at BOOKING time, so CONFIRMED→COMPLETED (and a repeated
    // COMPLETED→COMPLETED no-op) must NOT touch the online counter. The decrement/restore
    // now key on crossing the CANCELLED/NO_SHOW occupancy boundary, not on completion.
    // =========================================================================
    @Test
    @DisplayName("TC-B1: updateBookingStatus — V72: completion does not consume the online package")
    void updateBookingStatus_completion_isCounterNeutralForOnlinePackage() {
        UUID bookingId = UUID.randomUUID();
        Booking booking = new Booking();
        setFieldReflectively(booking, "bookingId", bookingId);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setCreatedAt(LocalDateTime.now().minusDays(1));

        PackageCredit pc = new PackageCredit();
        booking.setPackageCredit(pc);
        booking.setCreditTrackedAtCreation(true); // V72: already consumed at booking time

        when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User admin = new User("Admin", "Test", "admin@test.it", "pwd", "000");
        admin.setRole(Role.ADMIN);

        // CONFIRMED -> COMPLETED: within the occupancy boundary → no counter movement.
        BookingResponseDTO r1 = bookingService.updateBookingStatus(bookingId, BookingStatus.COMPLETED, admin);
        assertThat(r1.bookingStatus()).isEqualTo(BookingStatus.COMPLETED);

        // COMPLETED -> COMPLETED: same-status no-op.
        BookingResponseDTO r2 = bookingService.updateBookingStatus(bookingId, BookingStatus.COMPLETED, admin);
        assertThat(r2.bookingStatus()).isEqualTo(BookingStatus.COMPLETED);

        verify(packageCreditService, never()).consumeSessionForBooking(any());
        verify(packageCreditService, never()).restoreSessionForBooking(any());
    }

    @Test
    @DisplayName("TC-B-Customer: createManualConfirmedBookingAsAdmin links customer to booking")
    void createManualBooking_linksCustomerToBooking() {
        // Arrange
        UUID serviceId = UUID.randomUUID();
        UUID optionId  = UUID.randomUUID();

        ServiceItem svc = new ServiceItem();
        setFieldReflectively(svc, "serviceId", serviceId);
        svc.setDurationMin(30);
        svc.setTitle("Test Service");
        svc.setActive(true);

        ServiceOption opt = new ServiceOption();
        opt.setOptionId(optionId);
        opt.setService(svc);
        opt.setActive(true);

        LocalDateTime start = LocalDateTime.now().plusHours(2).withSecond(0).withNano(0);

        NewBookingDTO payload = new NewBookingDTO(
                "Mario Rossi",
                "mario.rossi@test.it",
                "+391234567890",
                start,
                "Note test",
                serviceId,
                null,    // serviceIds
                optionId,
                null,    // packageCreditId
                false,
                false,
                null,
                null,
                null,
                false
        );

        when(serviceItemService.findServiceItemById(serviceId)).thenReturn(svc);
        when(serviceOptionRepository.findById(optionId)).thenReturn(Optional.of(opt));
        when(bookingRepository.lockOverlappingBookingsByStatuses(any(), any(), anyList())).thenReturn(java.util.List.of());

        Customer mockCustomer = new Customer();
        when(customerService.findOrCreate(anyString(), anyString(), anyString(), any()))
                .thenReturn(mockCustomer);

        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(bookingRepository.findByIdWithDetails(any())).thenAnswer(inv -> Optional.of(invocationBookingWithId(inv.getArgument(0))));

        User admin = new User("Admin", "Test", "admin@test.it", "pwd", "000");
        admin.setRole(Role.ADMIN);

        // Act
        bookingService.createManualConfirmedBookingAsAdmin(payload, admin);

        // Assert
        verify(customerService, times(1)).findOrCreate(anyString(), anyString(), anyString(), any());

        ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(captor.capture());
        assertThat(captor.getValue().getCustomer()).isEqualTo(mockCustomer);
    }

    // =========================================================================
    // Fix 14: the shared overlap check now also rejects Michela's personal time.
    // A synchronous create must be refused (same behavior as a booking overlap)
    // when a personal appointment overlaps the requested slot, and must proceed
    // when the personal appointment does not overlap.
    // =========================================================================
    @Test
    @DisplayName("Fix 14: create rejected when a personal appointment overlaps the slot")
    void createBooking_rejectedWhenOverlapsPersonalAppointment() {
        UUID serviceId = UUID.randomUUID();

        ServiceItem svc = new ServiceItem();
        setFieldReflectively(svc, "serviceId", serviceId);
        svc.setDurationMin(30);
        svc.setTitle("Test Service");
        svc.setActive(true);

        // Requested slot: 10:00–10:30
        LocalDateTime start = LocalDateTime.of(2030, 1, 15, 10, 0);

        // Personal appointment 10:15–10:45 overlaps the slot.
        PersonalAppointment pa = new PersonalAppointment();
        pa.setTitle("Dentista");
        pa.setAppointmentDate(start.toLocalDate());
        pa.setStartTime(LocalTime.of(10, 15));
        pa.setDurationMinutes(30);

        NewBookingDTO payload = new NewBookingDTO(
                "Mario Rossi", "mario.rossi@test.it", "+391234567890",
                start, "Note test", serviceId,
                null,    // serviceIds
                null,    // serviceOptionId
                null,    // packageCreditId
                false, false, null, null, null, false
        );

        when(serviceItemService.findServiceItemById(serviceId)).thenReturn(svc);
        // No client booking conflicts — only personal time blocks here.
        when(bookingRepository.lockOverlappingBookingsByStatuses(any(), any(), anyList()))
                .thenReturn(java.util.List.of());
        when(personalAppointmentRepository.findByAppointmentDateOrderByStartTime(start.toLocalDate()))
                .thenReturn(java.util.List.of(pa));

        User admin = new User("Admin", "Test", "admin@test.it", "pwd", "000");
        admin.setRole(Role.ADMIN);

        assertThatThrownBy(() -> bookingService.createManualConfirmedBookingAsAdmin(payload, admin))
                .isInstanceOf(BadRequestException.class);

        // Same hard-reject behavior as a booking overlap: nothing is persisted.
        verify(bookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("Fix 14: create proceeds when the personal appointment does not overlap")
    void createBooking_proceedsWhenPersonalAppointmentDoesNotOverlap() {
        UUID serviceId = UUID.randomUUID();

        ServiceItem svc = new ServiceItem();
        setFieldReflectively(svc, "serviceId", serviceId);
        svc.setDurationMin(30);
        svc.setTitle("Test Service");
        svc.setActive(true);

        // Requested slot: 10:00–10:30
        LocalDateTime start = LocalDateTime.of(2030, 1, 15, 10, 0);

        // Personal appointment 08:00–08:30 does NOT overlap the slot.
        PersonalAppointment pa = new PersonalAppointment();
        pa.setTitle("Palestra");
        pa.setAppointmentDate(start.toLocalDate());
        pa.setStartTime(LocalTime.of(8, 0));
        pa.setDurationMinutes(30);

        NewBookingDTO payload = new NewBookingDTO(
                "Mario Rossi", "mario.rossi@test.it", "+391234567890",
                start, "Note test", serviceId,
                null,    // serviceIds
                null,    // serviceOptionId
                null,    // packageCreditId
                false, false, null, null, null, false
        );

        when(serviceItemService.findServiceItemById(serviceId)).thenReturn(svc);
        when(bookingRepository.lockOverlappingBookingsByStatuses(any(), any(), anyList()))
                .thenReturn(java.util.List.of());
        when(personalAppointmentRepository.findByAppointmentDateOrderByStartTime(start.toLocalDate()))
                .thenReturn(java.util.List.of(pa));
        when(customerService.findOrCreate(anyString(), anyString(), anyString(), any()))
                .thenReturn(new Customer());
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(bookingRepository.findByIdWithDetails(any()))
                .thenAnswer(inv -> Optional.of(invocationBookingWithId(inv.getArgument(0))));

        User admin = new User("Admin", "Test", "admin@test.it", "pwd", "000");
        admin.setRole(Role.ADMIN);

        // Non-overlapping personal time must NOT block the booking.
        bookingService.createManualConfirmedBookingAsAdmin(payload, admin);

        verify(bookingRepository, atLeastOnce()).save(any());
    }

    // =========================================================================
    // TC-5a: Phase 5a — maybeRecalculatePackage iterates over N in-person links
    // =========================================================================
    @Test
    @DisplayName("TC-5a: cancelling a booking with N in-person package links recalculates EACH assignment")
    void updateBookingStatus_cancelled_recalculatesAllLinkedAssignments() {
        UUID bookingId    = UUID.randomUUID();
        UUID assignmentA  = UUID.randomUUID();
        UUID assignmentB  = UUID.randomUUID();

        Booking booking = new Booking();
        setFieldReflectively(booking, "bookingId", bookingId);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setCreatedAt(LocalDateTime.now().minusDays(1));
        booking.setStartTime(LocalDateTime.now().plusHours(2));

        when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Two mock links pointing at distinct assignments — the new plural
        // maybeRecalculatePackage path must invoke recalculatePackageSessions once
        // per assignment, NOT just once for the first one (the singular bug Phase 5a fixes).
        ClientPackageAssignment a = new ClientPackageAssignment();
        setFieldReflectively(a, "id", assignmentA);
        ClientPackageAssignment b = new ClientPackageAssignment();
        setFieldReflectively(b, "id", assignmentB);
        BookingPackageLink linkA = new BookingPackageLink();
        linkA.setAssignment(a);
        BookingPackageLink linkB = new BookingPackageLink();
        linkB.setAssignment(b);
        when(bookingPackageLinkRepository.findAllByBookingBookingIdWithAssignment(bookingId))
                .thenReturn(List.of(linkA, linkB));

        User admin = new User("Admin", "Test", "admin@test.it", "pwd", "000");
        admin.setRole(Role.ADMIN);

        // CONFIRMED → CANCELLED triggers maybeRecalculatePackage(bookingId)
        bookingService.updateBookingStatus(bookingId, BookingStatus.CANCELLED, admin);

        verify(clientPackageService, times(1)).recalculatePackageSessions(assignmentA);
        verify(clientPackageService, times(1)).recalculatePackageSessions(assignmentB);
        verifyNoMoreInteractions(
                ignoreStubs(clientPackageService) // any other invocations would be a regression
        );
    }

    // =========================================================================
    // BE-3: reconcileStandaloneSales — standalone product sales <-> Product.stock.
    // Private method, exercised in isolation via reflection (invokeReconcile below).
    // =========================================================================

    @Test
    @DisplayName("BE-3: create — one new product decrements stock and saves a standalone sale")
    void reconcileStandaloneSales_create_oneNewProduct_decrementsStockAndSavesSale() {
        UUID bookingId = UUID.randomUUID();
        UUID productId  = UUID.randomUUID();

        Product product = new Product();
        setFieldReflectively(product, "productId", productId);
        product.setName("Crema Viso");
        product.setStock(10);

        when(bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(bookingId)).thenReturn(List.of());
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));

        AdminBookingCreateDTO dto = dtoWithSales(List.of(
                new SaleEntryDTO(productId, 2, new BigDecimal("19.90"), true)));

        invokeReconcile(bookingId, dto);

        ArgumentCaptor<Product> pc = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(pc.capture());
        assertThat(pc.getValue().getStock()).isEqualTo(8); // 10 - 2

        ArgumentCaptor<BookingSale> sc = ArgumentCaptor.forClass(BookingSale.class);
        verify(bookingSaleRepository).save(sc.capture());
        BookingSale saved = sc.getValue();
        assertThat(saved.getPromotionLinkId()).isNull(); // standalone, never a promo line
        assertThat(saved.getBookingId()).isEqualTo(bookingId);
        assertThat(saved.getProductId()).isEqualTo(productId);
        assertThat(saved.getProductName()).isEqualTo("Crema Viso");
        assertThat(saved.getQuantity()).isEqualTo(2);
        assertThat(saved.getUnitPrice()).isEqualByComparingTo(new BigDecimal("19.90"));
        assertThat(saved.isPaid()).isTrue();
        verify(bookingSaleRepository, never()).delete(any());
    }

    @Test
    @DisplayName("BE-3: update — removing a standalone sale restores stock and deletes the row")
    void reconcileStandaloneSales_update_removeStandaloneSale_restoresStockAndDeletes() {
        UUID bookingId = UUID.randomUUID();
        UUID productId  = UUID.randomUUID();

        Product product = new Product();
        setFieldReflectively(product, "productId", productId);
        product.setName("Crema Viso");
        product.setStock(5);

        BookingSale existing = new BookingSale();
        existing.setBookingId(bookingId);
        existing.setProductId(productId);
        existing.setProductName("Crema Viso");
        existing.setQuantity(3);
        existing.setUnitPrice(new BigDecimal("19.90"));
        // promotionLinkId stays null -> standalone

        when(bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(bookingId)).thenReturn(List.of(existing));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));

        AdminBookingCreateDTO dto = dtoWithSales(List.of()); // empty -> remove all standalone

        invokeReconcile(bookingId, dto);

        ArgumentCaptor<Product> pc = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(pc.capture());
        assertThat(pc.getValue().getStock()).isEqualTo(8); // 5 + 3 restored

        verify(bookingSaleRepository).delete(existing);
        verify(bookingSaleRepository, never()).save(any());
    }

    @Test
    @DisplayName("BE-3: update — qty 2->3 decrements stock by 1 and updates the kept sale (no churn)")
    void reconcileStandaloneSales_update_qtyIncrease_adjustsStockAndUpdatesSale() {
        UUID bookingId = UUID.randomUUID();
        UUID productId  = UUID.randomUUID();

        Product product = new Product();
        setFieldReflectively(product, "productId", productId);
        product.setName("Crema Viso");
        product.setStock(10);

        BookingSale existing = new BookingSale();
        existing.setBookingId(bookingId);
        existing.setProductId(productId);
        existing.setProductName("Crema Viso");
        existing.setQuantity(2);
        existing.setUnitPrice(new BigDecimal("19.90"));

        when(bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(bookingId)).thenReturn(List.of(existing));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));

        AdminBookingCreateDTO dto = dtoWithSales(List.of(
                new SaleEntryDTO(productId, 3, new BigDecimal("19.90"), false)));

        invokeReconcile(bookingId, dto);

        // delta = oldTotal(2) - new(3) = -1 -> decrement: 10 - 1
        ArgumentCaptor<Product> pc = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(pc.capture());
        assertThat(pc.getValue().getStock()).isEqualTo(9);

        ArgumentCaptor<BookingSale> sc = ArgumentCaptor.forClass(BookingSale.class);
        verify(bookingSaleRepository).save(sc.capture());
        assertThat(sc.getValue()).isSameAs(existing);        // kept row reused, not recreated
        assertThat(sc.getValue().getQuantity()).isEqualTo(3);
        verify(bookingSaleRepository, never()).delete(any());
    }

    @Test
    @DisplayName("BE-3: saleEntries() == null is a no-op (no sale/product writes)")
    void reconcileStandaloneSales_nullSaleEntries_isNoOp() {
        UUID bookingId = UUID.randomUUID();
        AdminBookingCreateDTO dto = dtoWithSales(null); // caller omitted products entirely

        invokeReconcile(bookingId, dto);

        verifyNoInteractions(bookingSaleRepository);
        verifyNoInteractions(productRepository);
    }

    // =========================================================================
    // BE-5: restore standalone-sale stock on booking cancel / hard-delete.
    // Mirrors the promo restore (same call sites, same guard) so cancel-then-
    // delete restores Product.stock EXACTLY once. Driven through the public
    // methods so the real guard — not just the helper — is exercised.
    // =========================================================================

    @Test
    @DisplayName("BE-5: cancel — a standalone sale restores Product.stock by its qty")
    void cancelBooking_withStandaloneSale_restoresStock() {
        UUID bookingId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        Booking booking = new Booking();
        setFieldReflectively(booking, "bookingId", bookingId);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setStartTime(LocalDateTime.now().plusHours(2));
        // stripeSessionId stays null -> in-store booking, cancel allowed

        Product product = new Product();
        setFieldReflectively(product, "productId", productId);
        product.setName("Crema Viso");
        product.setStock(5);

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(bookingId))
                .thenReturn(List.of(standaloneSale(bookingId, productId, 3)));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));
        when(bookingPackageLinkRepository.findAllByBookingBookingIdWithAssignment(bookingId))
                .thenReturn(List.of());

        bookingService.cancelBooking(bookingId, adminUser(), "test");

        ArgumentCaptor<Product> pc = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(pc.capture());
        assertThat(pc.getValue().getStock()).isEqualTo(8); // 5 + 3 restored
        assertThat(booking.getBookingStatus()).isEqualTo(BookingStatus.CANCELLED);
    }

    @Test
    @DisplayName("BE-5: hard-delete of a held booking restores standalone stock BEFORE the row is deleted")
    void hardDeleteBooking_withStandaloneSale_restoresStockBeforeDelete() {
        UUID bookingId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        Booking booking = new Booking();
        setFieldReflectively(booking, "bookingId", bookingId);
        booking.setBookingStatus(BookingStatus.CONFIRMED); // still "held" -> delete restores stock
        // stripeSessionId null -> not paid online -> delete allowed

        Product product = new Product();
        setFieldReflectively(product, "productId", productId);
        product.setName("Crema Viso");
        product.setStock(5);

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(bookingId))
                .thenReturn(List.of(standaloneSale(bookingId, productId, 3)));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));
        when(bookingPackageLinkRepository.findAllByBookingBookingIdWithAssignment(bookingId))
                .thenReturn(List.of());
        when(bookingPromotionLinkRepository.findAllByBookingBookingId(bookingId)).thenReturn(List.of());
        Query delQuery = mock(Query.class);
        when(entityManager.createQuery(anyString())).thenReturn(delQuery);
        when(delQuery.setParameter(anyString(), any())).thenReturn(delQuery);
        // @PersistenceContext field: @InjectMocks resolves BookingService via constructor injection,
        // which skips field injection — so wire the EntityManager mock into the field by hand.
        setFieldReflectively(bookingService, "entityManager", entityManager);

        bookingService.hardDeleteBooking(bookingId, adminUser());

        ArgumentCaptor<Product> pc = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(pc.capture());
        assertThat(pc.getValue().getStock()).isEqualTo(8); // 5 + 3 restored

        // Restore MUST precede the booking-row delete: booking_sales has ON DELETE CASCADE (V15),
        // so the sale row vanishes the instant the booking row is removed.
        InOrder inOrder = inOrder(productRepository, bookingRepository);
        inOrder.verify(productRepository).save(any(Product.class));
        inOrder.verify(bookingRepository).deleteById(bookingId);
    }

    @Test
    @DisplayName("BE-5: cancel THEN delete restores standalone stock EXACTLY once (the guard)")
    void cancelThenDelete_restoresStandaloneStockExactlyOnce() {
        UUID bookingId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        Booking booking = new Booking();
        setFieldReflectively(booking, "bookingId", bookingId);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setStartTime(LocalDateTime.now().plusHours(2));

        Product product = new Product();
        setFieldReflectively(product, "productId", productId);
        product.setName("Crema Viso");
        product.setStock(5);

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(bookingSaleRepository.findByBookingIdOrderByAddedAtDesc(bookingId))
                .thenReturn(List.of(standaloneSale(bookingId, productId, 3)));
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));
        when(bookingPackageLinkRepository.findAllByBookingBookingIdWithAssignment(bookingId))
                .thenReturn(List.of());
        when(bookingPromotionLinkRepository.findAllByBookingBookingId(bookingId)).thenReturn(List.of());
        Query delQuery = mock(Query.class);
        when(entityManager.createQuery(anyString())).thenReturn(delQuery);
        when(delQuery.setParameter(anyString(), any())).thenReturn(delQuery);
        // @PersistenceContext field: @InjectMocks resolves BookingService via constructor injection,
        // which skips field injection — so wire the EntityManager mock into the field by hand.
        setFieldReflectively(bookingService, "entityManager", entityManager);

        bookingService.cancelBooking(bookingId, adminUser(), "test"); // CONFIRMED -> CANCELLED, restore +3
        bookingService.hardDeleteBooking(bookingId, adminUser());      // CANCELLED -> guard skips the restore

        // Exactly one restore: stock 5 -> 8 (not 11), Product saved a single time across BOTH calls.
        assertThat(product.getStock()).isEqualTo(8);
        verify(productRepository, times(1)).save(any(Product.class));
    }

    private static User adminUser() {
        User admin = new User("Admin", "Test", "admin@test.it", "pwd", "000");
        admin.setRole(Role.ADMIN);
        return admin;
    }

    // =========================================================================
    // Fix 3: createOnlineProductSales — online-paid products of a mixed cart.
    // Mirrors the create branch of reconcileStandaloneSales, but post-payment it
    // NEVER rejects (missing product / short stock -> notify admin, honour the sale).
    // =========================================================================
    @Test
    @DisplayName("Fix 3: online product sale — decrements stock and saves a paid standalone sale")
    void createOnlineProductSales_create_decrementsStockAndSavesPaidSale() {
        UUID bookingId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        Product product = new Product();
        setFieldReflectively(product, "productId", productId);
        product.setName("Crema Viso");
        product.setStock(5);

        when(productRepository.findById(productId)).thenReturn(Optional.of(product));

        invokeCreateOnlineProductSales(bookingId, List.of(
                new SaleEntryDTO(productId, 2, new BigDecimal("19.90"), true)));

        ArgumentCaptor<Product> pc = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(pc.capture());
        assertThat(pc.getValue().getStock()).isEqualTo(3); // 5 - 2

        ArgumentCaptor<BookingSale> sc = ArgumentCaptor.forClass(BookingSale.class);
        verify(bookingSaleRepository).save(sc.capture());
        BookingSale saved = sc.getValue();
        assertThat(saved.getBookingId()).isEqualTo(bookingId);
        assertThat(saved.getProductId()).isEqualTo(productId);
        assertThat(saved.getProductName()).isEqualTo("Crema Viso");
        assertThat(saved.getQuantity()).isEqualTo(2);
        assertThat(saved.getUnitPrice()).isEqualByComparingTo(new BigDecimal("19.90")); // == charged cents
        assertThat(saved.isPaid()).isTrue();
        assertThat(saved.getPromotionLinkId()).isNull();   // standalone online sale, never a promo line
        assertThat(saved.getOriginalUnitPrice()).isNull();
        verifyNoInteractions(notificationService);          // no stock issue -> no admin notification
    }

    @Test
    @DisplayName("Fix 3: online product sale — insufficient stock still records the sale (stock goes negative) and notifies admin")
    void createOnlineProductSales_insufficientStock_recordsSaleGoesNegative_andNotifies() {
        UUID bookingId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        Product product = new Product();
        setFieldReflectively(product, "productId", productId);
        product.setName("Siero");
        product.setStock(1);

        when(productRepository.findById(productId)).thenReturn(Optional.of(product));

        invokeCreateOnlineProductSales(bookingId, List.of(
                new SaleEntryDTO(productId, 3, new BigDecimal("30.00"), true)));

        ArgumentCaptor<Product> pc = ArgumentCaptor.forClass(Product.class);
        verify(productRepository).save(pc.capture());
        assertThat(pc.getValue().getStock()).isEqualTo(-2); // 1 - 3, honoured (customer already paid)

        verify(bookingSaleRepository).save(any(BookingSale.class)); // sale still created, no throw
        verify(notificationService).create(
                eq(NotificationType.BOOKING_STOCK_WARNING), anyString(), anyString(), eq(bookingId), eq("BOOKING"));
    }

    @Test
    @DisplayName("Fix 3: online product sale — a missing product is skipped (no sale, no stock change) and admin notified")
    void createOnlineProductSales_productNotFound_skipsAndNotifies() {
        UUID bookingId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        when(productRepository.findById(productId)).thenReturn(Optional.empty());

        invokeCreateOnlineProductSales(bookingId, List.of(
                new SaleEntryDTO(productId, 1, new BigDecimal("10.00"), true)));

        verify(productRepository, never()).save(any());
        verify(bookingSaleRepository, never()).save(any());
        verify(notificationService).create(
                eq(NotificationType.BOOKING_STOCK_WARNING), anyString(), anyString(), eq(bookingId), eq("BOOKING"));
    }

    @Test
    @DisplayName("Fix 3: online product sale — empty list is a no-op (service-only & promo carts)")
    void createOnlineProductSales_emptyList_isNoOp() {
        invokeCreateOnlineProductSales(UUID.randomUUID(), List.of());
        verifyNoInteractions(productRepository);
        verifyNoInteractions(bookingSaleRepository);
        verifyNoInteractions(notificationService);
    }

    // =========================================================================
    // Fix 15: the webhook (online cart) path writes one booking_services row per
    // (service, option) via native INSERT — so the SAME service added with two
    // different options yields two distinct, distinguishable rows. The @ManyToMany
    // (which only knows (booking_id, service_id)) is suppressed, and customTotalPrice
    // (Fix 11) stays the authoritative frozen total.
    // =========================================================================
    @Test
    @DisplayName("Fix 15: webhook writes a booking_services row per (service, option) with option_id + 0-based sort_order; @ManyToMany suppressed; customTotalPrice unchanged")
    void createMultiServiceBookingFromWebhook_repeatedService_writesPerRowOptionId() {
        UUID serviceA = UUID.randomUUID();
        UUID opt1 = UUID.randomUUID();
        UUID opt2 = UUID.randomUUID();

        ServiceItem svcA = new ServiceItem();
        setFieldReflectively(svcA, "serviceId", serviceA);
        svcA.setDurationMin(30);
        svcA.setTitle("Laser");
        svcA.setActive(true);
        when(serviceItemService.findServiceItemById(serviceA)).thenReturn(svcA);

        ServiceOption o1 = new ServiceOption();
        o1.setOptionId(opt1);
        o1.setService(svcA);
        when(serviceOptionRepository.findById(opt1)).thenReturn(Optional.of(o1)); // primary = first non-null

        when(bookingRepository.lockOverlappingBookingsByStatuses(any(), any(), anyList()))
                .thenReturn(List.of()); // no slot conflict
        when(customerService.findOrCreate(anyString(), anyString(), anyString(), any()))
                .thenReturn(new Customer());

        UUID bookingId = UUID.randomUUID();
        when(bookingRepository.save(any())).thenAnswer(inv -> {
            Booking b = inv.getArgument(0);
            setFieldReflectively(b, "bookingId", bookingId);
            return b;
        });

        // Native INSERT chain — booking_services has no JPA entity (mirror the existing native-query
        // mocking). @InjectMocks uses constructor injection, so wire the EntityManager field by hand.
        Query insertQ = mock(Query.class);
        when(entityManager.createNativeQuery(anyString())).thenReturn(insertQ);
        when(insertQ.setParameter(anyString(), any())).thenReturn(insertQ);
        setFieldReflectively(bookingService, "entityManager", entityManager);

        // serviceIds = [A, A], serviceOptionIds = [opt1, opt2] → two distinct rows for service A.
        bookingService.createMultiServiceBookingFromWebhook(
                List.of(serviceA, serviceA),
                LocalDate.now().plusDays(1), LocalTime.of(10, 0), 60,
                "Mario Rossi", "mario@test.it", "+390000000", "note", "sess_123",
                null,                       // promotionId
                List.of(),                  // productSales
                false, false,               // consentLaser, consentPmu
                new BigDecimal("80.00"),    // customTotalPrice (Fix 11 frozen total)
                List.of(opt1, opt2)         // serviceOptionIds (index-aligned)
        );

        // Two booking_services rows, each carrying its own option_id and 0-based sort_order.
        verify(entityManager, times(2)).createNativeQuery(contains("INSERT INTO booking_services"));
        verify(insertQ, times(2)).setParameter(eq("serviceId"), eq(serviceA));
        verify(insertQ).setParameter("optionId", opt1);
        verify(insertQ).setParameter("optionId", opt2);
        verify(insertQ).setParameter("sortOrder", 0);
        verify(insertQ).setParameter("sortOrder", 1);

        // @ManyToMany suppressed (no option-less rows) + Fix 11 total preserved + primary option mirrored.
        ArgumentCaptor<Booking> bc = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository, atLeastOnce()).save(bc.capture());
        Booking persisted = bc.getValue();
        assertThat(persisted.getServices()).isEmpty();
        assertThat(persisted.getCustomTotalPrice()).isEqualByComparingTo(new BigDecimal("80.00"));
        assertThat(persisted.getServiceOption()).isEqualTo(o1);
    }

    // =========================================================================
    // Fix 23 (Audit K): paid-but-rejected MULTI booking → CANCELLED tombstone +
    // a definitive "REJECTED" outcome the confirmation page can observe.
    // =========================================================================
    @Test
    @DisplayName("Fix 23: MULTI conflict tombstone — fresh session persists a CANCELLED row with sessionId + PAID_CONFLICT")
    void recordMultiServiceConflictTombstone_fresh_persistsCancelledTombstone() {
        when(bookingRepository.findByStripeSessionId("sess_X")).thenReturn(Optional.empty());
        UUID id = UUID.randomUUID();
        when(bookingRepository.save(any())).thenAnswer(inv -> {
            Booking b = inv.getArgument(0);
            setFieldReflectively(b, "bookingId", id);
            return b;
        });

        Booking result = bookingService.recordMultiServiceConflictTombstone(
                LocalDate.now().plusDays(1), LocalTime.of(10, 0), 60,
                "Mario Rossi", "Mario@Test.IT", "+390000000", "sess_X", true);

        ArgumentCaptor<Booking> bc = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(bc.capture());
        Booking saved = bc.getValue();
        assertThat(saved.getBookingStatus()).isEqualTo(BookingStatus.CANCELLED);
        assertThat(saved.getStripeSessionId()).isEqualTo("sess_X");
        assertThat(saved.getCancelReason()).isEqualTo("PAID_CONFLICT");
        assertThat(saved.getServices()).isEmpty();
        assertThat(saved.getDurationMinutes()).isEqualTo(60);
        assertThat(saved.getCustomerEmail()).isEqualTo("mario@test.it"); // trimmed + lowercased
        assertThat(saved.getCanceledAt()).isNotNull();
        assertThat(result.getBookingStatus()).isEqualTo(BookingStatus.CANCELLED);
    }

    @Test
    @DisplayName("Fix 23: MULTI conflict tombstone — refund failure records PAID_CONFLICT_REFUND_FAILED")
    void recordMultiServiceConflictTombstone_refundFailed_setsRefundPendingReason() {
        when(bookingRepository.findByStripeSessionId("sess_Y")).thenReturn(Optional.empty());
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        bookingService.recordMultiServiceConflictTombstone(
                LocalDate.now().plusDays(1), LocalTime.of(9, 0), 30,
                "Lucia", "lucia@test.it", "", "sess_Y", false);

        ArgumentCaptor<Booking> bc = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(bc.capture());
        assertThat(bc.getValue().getCancelReason()).isEqualTo("PAID_CONFLICT_REFUND_FAILED");
    }

    @Test
    @DisplayName("Fix 23: MULTI conflict tombstone — existing session is idempotent (no duplicate row, no second write)")
    void recordMultiServiceConflictTombstone_existing_isIdempotent() {
        // The controller gates the refund on this same findByStripeSessionId check, so an idempotent
        // service return (existing row, no save) is what guarantees "no duplicate / no second refund".
        Booking existing = new Booking();
        setFieldReflectively(existing, "bookingId", UUID.randomUUID());
        existing.setBookingStatus(BookingStatus.CANCELLED);
        existing.setStripeSessionId("sess_Z");
        when(bookingRepository.findByStripeSessionId("sess_Z")).thenReturn(Optional.of(existing));

        Booking result = bookingService.recordMultiServiceConflictTombstone(
                LocalDate.now().plusDays(1), LocalTime.of(10, 0), 60,
                "Mario", "mario@test.it", "+390000000", "sess_Z", true);

        assertThat(result).isSameAs(existing);
        verify(bookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("Fix 23: rejectionOutcomeForSession — CANCELLED + PAID_CONFLICT → REJECTED (MULTI summary)")
    void rejectionOutcomeForSession_paidConflict_returnsRejected() {
        Booking b = new Booking();
        b.setBookingStatus(BookingStatus.CANCELLED);
        b.setCancelReason("PAID_CONFLICT");
        when(bookingRepository.findByStripeSessionId("sess_R")).thenReturn(Optional.of(b));
        assertThat(bookingService.rejectionOutcomeForSession("sess_R")).isEqualTo("REJECTED");
    }

    @Test
    @DisplayName("Fix 23: rejectionOutcomeForBooking — CANCELLED + PAID_CONFLICT → REJECTED (single summary)")
    void rejectionOutcomeForBooking_paidConflict_returnsRejected() {
        UUID id = UUID.randomUUID();
        Booking b = new Booking();
        b.setBookingStatus(BookingStatus.CANCELLED);
        b.setCancelReason("PAID_CONFLICT");
        when(bookingRepository.findById(id)).thenReturn(Optional.of(b));
        assertThat(bookingService.rejectionOutcomeForBooking(id)).isEqualTo("REJECTED");
    }

    @Test
    @DisplayName("Fix 23: rejectionOutcome — refund-failed reason → REJECTED_REFUND_PENDING")
    void rejectionOutcomeForSession_refundFailed_returnsRefundPending() {
        Booking b = new Booking();
        b.setBookingStatus(BookingStatus.CANCELLED);
        b.setCancelReason("PAID_CONFLICT_REFUND_FAILED");
        when(bookingRepository.findByStripeSessionId("sess_P")).thenReturn(Optional.of(b));
        assertThat(bookingService.rejectionOutcomeForSession("sess_P")).isEqualTo("REJECTED_REFUND_PENDING");
    }

    @Test
    @DisplayName("Fix 23: rejectionOutcome — confirmed booking → null (normal confirmation unchanged)")
    void rejectionOutcomeForSession_confirmed_returnsNull() {
        Booking b = new Booking();
        b.setBookingStatus(BookingStatus.CONFIRMED);
        when(bookingRepository.findByStripeSessionId("sess_OK")).thenReturn(Optional.of(b));
        assertThat(bookingService.rejectionOutcomeForSession("sess_OK")).isNull();
    }

    @Test
    @DisplayName("Fix 23: rejectionOutcome — CANCELLED for a non-conflict reason → null (ordinary cancellation/expiry)")
    void rejectionOutcomeForSession_otherCancelReason_returnsNull() {
        Booking b = new Booking();
        b.setBookingStatus(BookingStatus.CANCELLED);
        b.setCancelReason("STRIPE_SESSION_EXPIRED");
        when(bookingRepository.findByStripeSessionId("sess_EXP")).thenReturn(Optional.of(b));
        assertThat(bookingService.rejectionOutcomeForSession("sess_EXP")).isNull();
    }

    @Test
    @DisplayName("Fix 23: rejectionOutcomeForSession — no row yet → null (still processing, not rejected)")
    void rejectionOutcomeForSession_noRow_returnsNull() {
        when(bookingRepository.findByStripeSessionId("sess_NONE")).thenReturn(Optional.empty());
        assertThat(bookingService.rejectionOutcomeForSession("sess_NONE")).isNull();
    }

    private static BookingSale standaloneSale(UUID bookingId, UUID productId, int qty) {
        BookingSale s = new BookingSale();
        s.setBookingId(bookingId);
        s.setProductId(productId);
        s.setProductName("Crema Viso");
        s.setQuantity(qty);
        s.setUnitPrice(new BigDecimal("19.90"));
        // promotionLinkId stays null -> standalone
        return s;
    }

    // Invokes the private reconcileStandaloneSales on the @InjectMocks instance. The test
    // class lives in a different package, so reflection is the only access (mirrors the
    // reflective field helpers below). InvocationTargetException is unwrapped so a helper
    // exception surfaces with its real type.
    private void invokeReconcile(UUID bookingId, AdminBookingCreateDTO dto) {
        try {
            var m = BookingService.class.getDeclaredMethod(
                    "reconcileStandaloneSales", UUID.class, AdminBookingCreateDTO.class);
            m.setAccessible(true);
            m.invoke(bookingService, bookingId, dto);
        } catch (java.lang.reflect.InvocationTargetException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException re) throw re;
            throw new RuntimeException(cause);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException("invokeReconcile failed", e);
        }
    }

    // Invokes the private createOnlineProductSales on the @InjectMocks instance (mirrors invokeReconcile).
    private void invokeCreateOnlineProductSales(UUID bookingId, List<SaleEntryDTO> sales) {
        try {
            var m = BookingService.class.getDeclaredMethod(
                    "createOnlineProductSales", UUID.class, List.class);
            m.setAccessible(true);
            m.invoke(bookingService, bookingId, sales);
        } catch (java.lang.reflect.InvocationTargetException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException re) throw re;
            throw new RuntimeException(cause);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException("invokeCreateOnlineProductSales failed", e);
        }
    }

    // Minimal AdminBookingCreateDTO carrying only saleEntries — every other component is
    // irrelevant to the reconcile. Positional ctor: keep in sync if the record changes.
    private static AdminBookingCreateDTO dtoWithSales(List<SaleEntryDTO> sales) {
        return new AdminBookingCreateDTO(
                "Cliente Test", null, null, null,    // customerName, phone, email, customerId
                null,                                 // serviceIds
                false, null, null, null,             // hasCustomService, name, price, durationMin
                null, null, null,                     // packageAssignmentId, packageAssignmentIds, packageCreditId
                null, null,                           // currentSession, totalSessions
                LocalDate.now(), LocalTime.of(10, 0), // date, startTime
                null, null,                           // notes, paddingMinutes
                false, false,                         // consentLaser, consentPmu
                null, null,                           // serviceOptionId, paidInStore
                null, null,                           // customTotalDurationMin, customTotalPrice
                null,                                 // serviceEntries
                null,                                 // customServicePaid
                null,                                 // packageSessionPaid
                null, null,                           // promotionIds, promotionPaid
                sales                                 // saleEntries
        );
    }

    /**
     * Helper: creates a Booking-like object for findByIdWithDetails stubbing.
     * BookingService only needs a non-empty Optional for hydration step.
     */
    private static Booking invocationBookingWithId(UUID bookingId) {
        Booking b = new Booking();
        setFieldReflectively(b, "bookingId", bookingId);
        return b;
    }

    // Helper riflessivo per impostare campi privati (es. bookingId)
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

