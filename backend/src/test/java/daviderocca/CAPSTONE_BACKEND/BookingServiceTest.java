package daviderocca.CAPSTONE_BACKEND;

import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.Customer;
import daviderocca.CAPSTONE_BACKEND.entities.PackageCredit;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceItem;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceOption;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import daviderocca.CAPSTONE_BACKEND.enums.Role;
import daviderocca.CAPSTONE_BACKEND.repositories.BookingRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.ServiceOptionRepository;
import daviderocca.CAPSTONE_BACKEND.services.BookingService;
import daviderocca.CAPSTONE_BACKEND.services.CustomerService;
import daviderocca.CAPSTONE_BACKEND.services.PackageCreditService;
import daviderocca.CAPSTONE_BACKEND.services.ServiceItemService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

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
                optionId,
                null,
                null,
                null
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

