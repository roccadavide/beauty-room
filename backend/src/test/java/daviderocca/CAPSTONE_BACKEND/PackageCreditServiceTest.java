package daviderocca.CAPSTONE_BACKEND;

import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.PackageCredit;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceItem;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceOption;
import daviderocca.CAPSTONE_BACKEND.enums.PackageCreditStatus;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.DuplicateResourceException;
import daviderocca.CAPSTONE_BACKEND.repositories.PackageCreditRepository;
import daviderocca.CAPSTONE_BACKEND.services.PackageCreditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PackageCreditServiceTest {

    @Mock
    private PackageCreditRepository repo;

    @InjectMocks
    private PackageCreditService service;

    private ServiceItem serviceItem;
    private ServiceOption serviceOption;
    private UUID optionId;

    @BeforeEach
    void setUp() {
        optionId = UUID.randomUUID();

        serviceOption = new ServiceOption();
        serviceOption.setOptionId(optionId);
        serviceOption.setName("Pulizia viso 60 min");

        serviceItem = new ServiceItem();
    }

    // =========================================================================
    // TC-1: creazione pacchetto con successo
    // =========================================================================
    @Test
    @DisplayName("TC-1: createPackageCredit — crea correttamente con expiryDate")
    void createPackageCredit_success() {
        when(repo.existsByCustomerEmailIgnoreCaseAndServiceOptionOptionIdAndStatus(
                anyString(), any(), eq(PackageCreditStatus.ACTIVE))).thenReturn(false);
        when(repo.save(any(PackageCredit.class))).thenAnswer(inv -> {
            PackageCredit pc = inv.getArgument(0);
            // simula @PrePersist
            setFieldReflectively(pc, "purchasedAt", LocalDateTime.now());
            setFieldReflectively(pc, "expiryDate", LocalDateTime.now().plusMonths(24));
            return pc;
        });

        PackageCredit result = service.createPackageCredit(
                "cliente@test.it", 5, serviceItem, serviceOption, null, null, false);

        assertThat(result.getSessionsTotal()).isEqualTo(5);
        assertThat(result.getSessionsRemaining()).isEqualTo(5);
        assertThat(result.getStatus()).isEqualTo(PackageCreditStatus.ACTIVE);
        assertThat(result.getCustomerEmail()).isEqualTo("cliente@test.it");

        verify(repo).save(any(PackageCredit.class));
    }

    // =========================================================================
    // TC-1b: createPackageCredit — lancia BadRequestException se serviceOption è null
    // =========================================================================
    @Test
    @DisplayName("TC-1b: createPackageCredit — serviceOption null non consentito")
    void createPackageCredit_withoutServiceOption_throwsBadRequest() {
        assertThatThrownBy(() ->
                service.createPackageCredit("cliente@test.it", 5, serviceItem, null, null, null, false)
        ).isInstanceOf(BadRequestException.class)
         .hasMessageContaining("ServiceOption");

        verifyNoInteractions(repo);
    }

    // =========================================================================
    // TC-2: creazione secondo pacchetto stessa ServiceOption → errore
    // =========================================================================
    @Test
    @DisplayName("TC-2: createPackageCredit — lancia DuplicateResourceException se già ACTIVE")
    void createPackageCredit_duplicateActive_throwsDuplicate() {
        when(repo.existsByCustomerEmailIgnoreCaseAndServiceOptionOptionIdAndStatus(
                anyString(), eq(optionId), eq(PackageCreditStatus.ACTIVE))).thenReturn(true);

        assertThatThrownBy(() ->
                service.createPackageCredit("cliente@test.it", 5, serviceItem, serviceOption, null, null, false)
        ).isInstanceOf(DuplicateResourceException.class)
         .hasMessageContaining("già un pacchetto ACTIVE");

        verify(repo, never()).save(any());
    }

    // =========================================================================
    // TC-3: prenotazione con pacchetto — validateBookingWithPackage successo
    // =========================================================================
    @Test
    @DisplayName("TC-3: validateBookingWithPackage — non lancia eccezioni se tutto coerente")
    void validateBookingWithPackage_valid_noException() {
        PackageCredit pc = buildActivePackage(3, LocalDateTime.now().plusMonths(12));

        Booking booking = new Booking();
        booking.setPackageCredit(pc);
        booking.setServiceOption(serviceOption);

        assertThatCode(() -> service.validateBookingWithPackage(booking))
                .doesNotThrowAnyException();
    }

    // =========================================================================
    // TC-4: PENDING → COMPLETED → consumeSession decrementa sessioni
    // =========================================================================
    @Test
    @DisplayName("TC-4: consumeSessionForBooking — decrementa sessionsRemaining")
    void consumeSessionForBooking_decrementsRemaining() {
        PackageCredit pc = buildActivePackage(3, LocalDateTime.now().plusMonths(12));
        UUID pcId = pc.getPackageCreditId();

        Booking booking = new Booking();
        booking.setPackageCredit(pc);

        when(repo.findByIdForUpdate(pcId)).thenReturn(Optional.of(pc));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.consumeSessionForBooking(booking);

        ArgumentCaptor<PackageCredit> captor = ArgumentCaptor.forClass(PackageCredit.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getSessionsRemaining()).isEqualTo(2);
        assertThat(captor.getValue().getStatus()).isEqualTo(PackageCreditStatus.ACTIVE);
    }

    // =========================================================================
    // TC-5: COMPLETED → CANCELLED → restoreSession incrementa sessioni
    // =========================================================================
    @Test
    @DisplayName("TC-5: restoreSessionForBooking — incrementa sessionsRemaining e rimette ACTIVE")
    void restoreSessionForBooking_fromCompleted_restoresAndActivates() {
        PackageCredit pc = buildActivePackage(0, LocalDateTime.now().plusMonths(12));
        pc.setStatus(PackageCreditStatus.COMPLETED);
        UUID pcId = pc.getPackageCreditId();

        Booking booking = new Booking();
        booking.setPackageCredit(pc);

        when(repo.findByIdForUpdate(pcId)).thenReturn(Optional.of(pc));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.restoreSessionForBooking(booking);

        ArgumentCaptor<PackageCredit> captor = ArgumentCaptor.forClass(PackageCredit.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getSessionsRemaining()).isEqualTo(1);
        assertThat(captor.getValue().getStatus()).isEqualTo(PackageCreditStatus.ACTIVE);
    }

    // =========================================================================
    // TC-5b: restore non supera mai sessionsTotal
    // =========================================================================
    @Test
    @DisplayName("TC-5b: restoreSessionForBooking — non supera mai sessionsTotal")
    void restoreSessionForBooking_doesNotExceedTotal() {
        PackageCredit pc = buildPackage(5, 5, LocalDateTime.now().plusMonths(12));
        UUID pcId = pc.getPackageCreditId();

        Booking booking = new Booking();
        booking.setPackageCredit(pc);

        when(repo.findByIdForUpdate(pcId)).thenReturn(Optional.of(pc));

        service.restoreSessionForBooking(booking);

        // Nessun salvataggio perché già al massimo
        verify(repo, never()).save(any());
        assertThat(pc.getSessionsRemaining()).isEqualTo(5);
    }

    // =========================================================================
    // TC-6: COMPLETED → PENDING — stessa logica di restore (rollback generico)
    // =========================================================================
    @Test
    @DisplayName("TC-6: restoreSessionForBooking — funziona anche da ACTIVE (cambio parziale)")
    void restoreSessionForBooking_fromActive_incrementsRemaining() {
        PackageCredit pc = buildActivePackage(2, LocalDateTime.now().plusMonths(12));
        UUID pcId = pc.getPackageCreditId();

        Booking booking = new Booking();
        booking.setPackageCredit(pc);

        when(repo.findByIdForUpdate(pcId)).thenReturn(Optional.of(pc));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.restoreSessionForBooking(booking);

        ArgumentCaptor<PackageCredit> captor = ArgumentCaptor.forClass(PackageCredit.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getSessionsRemaining()).isEqualTo(3);
        assertThat(captor.getValue().getStatus()).isEqualTo(PackageCreditStatus.ACTIVE);
    }

    // =========================================================================
    // TC-7: sessionsRemaining 1 → COMPLETED al consumo
    // =========================================================================
    @Test
    @DisplayName("TC-7: consumeSessionForBooking — ultima seduta setta COMPLETED")
    void consumeSessionForBooking_lastSession_marksCompleted() {
        PackageCredit pc = buildActivePackage(1, LocalDateTime.now().plusMonths(12));
        UUID pcId = pc.getPackageCreditId();

        Booking booking = new Booking();
        booking.setPackageCredit(pc);

        when(repo.findByIdForUpdate(pcId)).thenReturn(Optional.of(pc));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.consumeSessionForBooking(booking);

        ArgumentCaptor<PackageCredit> captor = ArgumentCaptor.forClass(PackageCredit.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getSessionsRemaining()).isEqualTo(0);
        assertThat(captor.getValue().getStatus()).isEqualTo(PackageCreditStatus.COMPLETED);
    }

    // =========================================================================
    // TC-EXPIRED-GRACE: EXPIRED ma booking creata prima della expiry → consumo permesso
    // =========================================================================
    @Test
    @DisplayName("TC-EXPIRED-GRACE: EXPIRED ma booking creata prima della expiry permette consumo")
    void consumeSessionForBooking_expiredButBookingBeforeExpiry_allowsConsumption() {
        LocalDateTime expiry = LocalDateTime.now().minusDays(1);
        PackageCredit pc = buildPackage(3, 5, expiry);
        pc.setStatus(PackageCreditStatus.EXPIRED);
        UUID pcId = pc.getPackageCreditId();

        Booking booking = new Booking();
        booking.setPackageCredit(pc);
        booking.setCreatedAt(expiry.minusDays(2)); // creata 2 giorni prima della scadenza
        booking.setStartTime(LocalDateTime.now().plusDays(1)); // appuntamento dopo la scadenza (contratto onorato)

        when(repo.findByIdForUpdate(pcId)).thenReturn(Optional.of(pc));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.consumeSessionForBooking(booking);

        ArgumentCaptor<PackageCredit> captor = ArgumentCaptor.forClass(PackageCredit.class);
        verify(repo).save(captor.capture());
        assertThat(captor.getValue().getSessionsRemaining()).isEqualTo(2);
    }

    // =========================================================================
    // TC-EXPIRED-NO-GRACE: EXPIRED e booking creata dopo la expiry → errore
    // =========================================================================
    @Test
    @DisplayName("TC-EXPIRED-NO-GRACE: EXPIRED e booking creata dopo la expiry lancia errore")
    void consumeSessionForBooking_expiredAndBookingAfterExpiry_throws() {
        LocalDateTime expiry = LocalDateTime.now().minusDays(3);
        PackageCredit pc = buildPackage(3, 5, expiry);
        pc.setStatus(PackageCreditStatus.EXPIRED);
        UUID pcId = pc.getPackageCreditId();

        Booking booking = new Booking();
        booking.setPackageCredit(pc);
        booking.setCreatedAt(expiry.plusDays(1)); // creata dopo la scadenza

        when(repo.findByIdForUpdate(pcId)).thenReturn(Optional.of(pc));

        assertThatThrownBy(() -> service.consumeSessionForBooking(booking))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("scaduto");
    }

    // =========================================================================
    // TC-8: expiryDate superata → expireOverduePackages setta EXPIRED
    // =========================================================================
    @Test
    @DisplayName("TC-8: expireOverduePackages — marca EXPIRED tutti i pacchetti scaduti")
    void expireOverduePackages_marksExpired() {
        PackageCredit pc1 = buildActivePackage(3, LocalDateTime.now().minusDays(1));
        PackageCredit pc2 = buildActivePackage(2, LocalDateTime.now().minusDays(10));

        when(repo.findByStatusAndExpiryDateBefore(eq(PackageCreditStatus.ACTIVE), any()))
                .thenReturn(List.of(pc1, pc2));

        int count = service.expireOverduePackages();

        assertThat(count).isEqualTo(2);
        assertThat(pc1.getStatus()).isEqualTo(PackageCreditStatus.EXPIRED);
        assertThat(pc2.getStatus()).isEqualTo(PackageCreditStatus.EXPIRED);
        verify(repo).saveAll(anyList());
    }

    // =========================================================================
    // TC-9: tentativo di usare pacchetto EXPIRED → validateBookingWithPackage lancia eccezione
    // =========================================================================
    @Test
    @DisplayName("TC-9: validateBookingWithPackage — lancia BadRequestException se status EXPIRED")
    void validateBookingWithPackage_expired_throwsBadRequest() {
        PackageCredit pc = buildActivePackage(2, LocalDateTime.now().plusMonths(1));
        pc.setStatus(PackageCreditStatus.EXPIRED);

        Booking booking = new Booking();
        booking.setPackageCredit(pc);
        booking.setServiceOption(serviceOption);

        assertThatThrownBy(() -> service.validateBookingWithPackage(booking))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("non è utilizzabile");
    }

    // =========================================================================
    // Caso limite: consumeSession con packageCredit null → no-op
    // =========================================================================
    @Test
    @DisplayName("Limite: consumeSessionForBooking — no-op se packageCredit null")
    void consumeSessionForBooking_nullPackage_isNoOp() {
        Booking booking = new Booking();
        // packageCredit null

        assertThatCode(() -> service.consumeSessionForBooking(booking))
                .doesNotThrowAnyException();
        verifyNoInteractions(repo);
    }

    // =========================================================================
    // Caso limite: ServiceOption non corrispondente → errore di coerenza
    // =========================================================================
    @Test
    @DisplayName("Limite: validateBookingWithPackage — lancia eccezione se serviceOption non corrisponde")
    void validateBookingWithPackage_wrongOption_throws() {
        PackageCredit pc = buildActivePackage(2, LocalDateTime.now().plusMonths(12));
        pc.setServiceOption(serviceOption); // optionId già impostato

        ServiceOption otherOption = new ServiceOption();
        otherOption.setOptionId(UUID.randomUUID()); // diverso

        Booking booking = new Booking();
        booking.setPackageCredit(pc);
        booking.setServiceOption(otherOption);

        assertThatThrownBy(() -> service.validateBookingWithPackage(booking))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("non è valido per la ServiceOption");
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private PackageCredit buildActivePackage(int remaining, LocalDateTime expiry) {
        return buildPackage(remaining, 5, expiry);
    }

    private PackageCredit buildPackage(int remaining, int total, LocalDateTime expiry) {
        PackageCredit pc = new PackageCredit();
        setFieldReflectively(pc, "packageCreditId", UUID.randomUUID());
        pc.setSessionsTotal(total);
        pc.setSessionsRemaining(remaining);
        pc.setStatus(PackageCreditStatus.ACTIVE);
        pc.setCustomerEmail("cliente@test.it");
        pc.setServiceOption(serviceOption);
        setFieldReflectively(pc, "purchasedAt", LocalDateTime.now().minusDays(30));
        pc.setExpiryDate(expiry);
        return pc;
    }

    /** Setter riflessivo per campi final / senza setter (es. packageCreditId con AccessLevel.NONE). */
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
