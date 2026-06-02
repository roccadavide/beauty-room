package daviderocca.beautyroom;

import daviderocca.beautyroom.DTO.customerDTOs.CustomerDetailDTO;
import daviderocca.beautyroom.entities.Customer;
import daviderocca.beautyroom.packages.ClientPackageAssignmentRepository;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.CustomerRepository;
import daviderocca.beautyroom.repositories.PackageCreditRepository;
import daviderocca.beautyroom.services.CustomerService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Focused unit tests for {@link CustomerService#getSummary} (V64 phone-keyed
 * history / arretrati). Pure Mockito.
 */
@ExtendWith(MockitoExtension.class)
class CustomerServiceTest {

    @Mock private CustomerRepository customerRepository;
    @Mock private PackageCreditRepository packageCreditRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private ClientPackageAssignmentRepository assignmentRepository;

    @InjectMocks private CustomerService customerService;

    @Test
    @DisplayName("getSummary — customer with no phone digits → no arretrati / history, queries never called")
    void getSummary_noPhone_shortCircuits() {
        UUID id = UUID.randomUUID();
        Customer c = new Customer(); // phone null, email null → no usable key
        setFieldReflectively(c, "customerId", id);
        when(customerRepository.findById(id)).thenReturn(Optional.of(c));

        CustomerDetailDTO dto = customerService.getSummary(id);

        // Short-circuit: an empty/absent phone must NOT hit the phone-keyed queries
        // (otherwise every phone-less customer would match every phone-less booking).
        assertThat(dto.arretrati()).isEmpty();
        assertThat(dto.bookings()).isEmpty();
        verify(bookingRepository, never()).findArretratiForCustomer(any());
        verify(bookingRepository, never()).findByCustomerPhoneNormalizedOrderByStartTimeDesc(any());
    }

    private static void setFieldReflectively(Object target, String fieldName, Object value) {
        try {
            var field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException("setFieldReflectively failed for " + fieldName, e);
        }
    }
}
