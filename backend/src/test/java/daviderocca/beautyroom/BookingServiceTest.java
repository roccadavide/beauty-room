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
import daviderocca.beautyroom.enums.Role;
import daviderocca.beautyroom.packages.BookingPackageLink;
import daviderocca.beautyroom.packages.BookingPackageLinkRepository;
import daviderocca.beautyroom.packages.ClientPackageAssignment;
import daviderocca.beautyroom.promotions.BookingPromotionLinkRepository;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.BookingSaleRepository;
import daviderocca.beautyroom.repositories.ProductRepository;
import daviderocca.beautyroom.repositories.ServiceOptionRepository;
import daviderocca.beautyroom.services.BookingService;
import daviderocca.beautyroom.packages.ClientPackageService;
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
    // Added as a final dependency of BookingService by the closure feature work
    // (commits before Phase 6e). Without mocking it createManualBooking ... NPEs
    // on closureService.assertNoOverlappingClosure(...). Pure test-infra fix.
    @Mock
    private daviderocca.beautyroom.services.ClosureService closureService;
    @Mock
    private BookingSaleRepository bookingSaleRepository;
    @Mock
    private ProductRepository productRepository;
    // BE-5: hardDeleteBooking touches these two — promo-artifact cleanup + the JPQL package-link delete.
    @Mock
    private BookingPromotionLinkRepository bookingPromotionLinkRepository;
    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private BookingService bookingService;

    // =========================================================================
    // TC-B1: doppio update COMPLETED non scala due volte (idempotenza)
    // =========================================================================
    @Test
    @DisplayName("TC-B1: updateBookingStatus — doppio COMPLETED non scala due volte")
    void updateBookingStatus_doubleCompleted_isIdempotentOnPackage() {
        UUID bookingId = UUID.randomUUID();
        Booking booking = new Booking();
        setFieldReflectively(booking, "bookingId", bookingId);
        booking.setBookingStatus(BookingStatus.CONFIRMED);
        booking.setCreatedAt(LocalDateTime.now().minusDays(1));

        PackageCredit pc = new PackageCredit();
        booking.setPackageCredit(pc);

        when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User admin = new User("Admin", "Test", "admin@test.it", "pwd", "000");
        admin.setRole(Role.ADMIN);

        // Primo passaggio: CONFIRMED -> COMPLETED (consuma 1)
        BookingResponseDTO r1 = bookingService.updateBookingStatus(bookingId, BookingStatus.COMPLETED, admin);
        assertThat(r1.bookingStatus()).isEqualTo(BookingStatus.COMPLETED);

        // Secondo passaggio: COMPLETED -> COMPLETED (no-op idempotente, nessun consumo)
        BookingResponseDTO r2 = bookingService.updateBookingStatus(bookingId, BookingStatus.COMPLETED, admin);
        assertThat(r2.bookingStatus()).isEqualTo(BookingStatus.COMPLETED);

        verify(packageCreditService, times(1)).consumeSessionForBooking(any());
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

