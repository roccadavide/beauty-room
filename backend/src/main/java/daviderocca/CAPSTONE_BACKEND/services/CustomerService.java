package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.customerDTOs.CustomerDetailDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.customerDTOs.CustomerSummaryDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Customer;
import daviderocca.CAPSTONE_BACKEND.enums.PackageCreditStatus;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.repositories.BookingRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.CustomerRepository;
import daviderocca.CAPSTONE_BACKEND.repositories.PackageCreditRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomerService {

    private static final String WALKIN_MARKER = "@beautyroom.local";

    private final CustomerRepository        customerRepository;
    private final PackageCreditRepository   packageCreditRepository;
    private final BookingRepository         bookingRepository;

    // ══════════════════════════════════════════════════════════════════════
    // FIND OR CREATE
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Returns an existing Customer matched by phone or email, or creates a
     * new one.  Called automatically on every admin booking creation so that
     * bookings accumulate a customer history over time.
     *
     * Deduplication order:
     *   1. phone  – most stable identifier for walk-in / recurring clients
     *   2. email  – for registered/online customers (skip walk-in emails)
     *   3. create – truly new or anonymous walk-in
     *
     * Race condition:
     *   If two requests race to create the same customer (same phone) the DB
     *   unique index on phone will reject the second INSERT.
     *   We catch DataIntegrityViolationException and retry the read.
     */
    @Transactional
    public Customer findOrCreate(String fullName, String phone, String email, String notes) {
        if (fullName == null || fullName.isBlank()) {
            throw new BadRequestException("Nome cliente obbligatorio.");
        }

        String name  = fullName.trim();
        String ph    = phone != null ? phone.trim() : null;
        String em    = email != null ? email.trim().toLowerCase() : null;
        boolean realEmail = em != null && !em.contains(WALKIN_MARKER);

        // 1 ── phone lookup
        if (ph != null && !ph.isBlank()) {
            Optional<Customer> byPhone = customerRepository.findByPhone(ph);
            if (byPhone.isPresent()) {
                log.debug("Customer found by phone [{}]: {}", ph, byPhone.get().getCustomerId());
                return byPhone.get();
            }
        }

        // 2 ── email lookup (real emails only)
        if (realEmail) {
            Optional<Customer> byEmail = customerRepository.findByEmail(em);
            if (byEmail.isPresent()) {
                log.debug("Customer found by email [{}]: {}", em, byEmail.get().getCustomerId());
                return byEmail.get();
            }
        }

        // 3 ── create new
        return createNew(name, ph, em, notes);
    }

    private Customer createNew(String fullName, String phone, String email, String notes) {
        try {
            Customer c = new Customer();
            c.setFullName(fullName);
            c.setPhone(phone);
            c.setEmail(email);
            c.setNotes(notes);
            Customer saved = customerRepository.save(c);
            log.info("New customer created: {} ({})", saved.getFullName(), saved.getCustomerId());
            return saved;
        } catch (DataIntegrityViolationException ex) {
            // Race condition: another thread already inserted this phone.
            // Retry the read rather than propagating the constraint error.
            log.warn("DataIntegrityViolation on customer insert (likely race on phone={}), retrying read.", phone);
            if (phone != null) {
                Optional<Customer> retry = customerRepository.findByPhone(phone);
                if (retry.isPresent()) return retry.get();
            }
            if (email != null && !email.contains(WALKIN_MARKER)) {
                Optional<Customer> retry = customerRepository.findByEmail(email);
                if (retry.isPresent()) return retry.get();
            }
            // If we still can't find it, re-throw so the caller is aware.
            throw new RuntimeException("Customer upsert failed after race-condition retry.", ex);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // AUTOCOMPLETE SEARCH
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Returns up to 10 customers matching the query (name / phone / email).
     * Returns empty list immediately for blank or too-short queries.
     */
    public List<CustomerSummaryDTO> search(String q) {
        if (q == null || q.isBlank() || q.trim().length() < 2) return List.of();
        return customerRepository
            .searchByQuery(q.trim(), PageRequest.of(0, 10))
            .stream()
            .map(c -> new CustomerSummaryDTO(
                c.getCustomerId(),
                c.getFullName(),
                c.getPhone(),
                c.getEmail()
            ))
            .toList();
    }

    // ══════════════════════════════════════════════════════════════════════
    // CUSTOMER DETAIL / SUMMARY
    // ══════════════════════════════════════════════════════════════════════

    /**
     * Returns a full customer card with:
     *   – active PackageCredits
     *   – last 5 bookings
     *
     * Uses the customer's email as the join key because existing Booking and
     * PackageCredit rows were created before this customer registry existed and
     * don't yet carry a customer_id FK.
     */
    @Transactional(readOnly = true)
    public CustomerDetailDTO getSummary(UUID customerId) {
        Customer customer = customerRepository.findById(customerId)
            .orElseThrow(() -> new ResourceNotFoundException(customerId));

        String email = customer.getEmail();

        // ── Active packages ──
        List<CustomerDetailDTO.ActivePackageDTO> packages = (email == null || email.contains(WALKIN_MARKER))
            ? List.of()
            : packageCreditRepository
                .findByCustomerEmailAndStatus(email, PackageCreditStatus.ACTIVE)
                .stream()
                .map(pc -> new CustomerDetailDTO.ActivePackageDTO(
                    pc.getPackageCreditId(),
                    pc.getServiceOption() != null ? pc.getServiceOption().getName() : "—",
                    pc.getSessionsRemaining(),
                    pc.getSessionsTotal(),
                    pc.getExpiryDate()
                ))
                .toList();

        // ── Recent bookings ──
        // NOTE: ServiceItem.getTitle() and ServiceOption.getName() are accessed
        // lazily inside this @Transactional method – no LazyInitializationException.
        List<CustomerDetailDTO.RecentBookingDTO> bookings = (email == null)
            ? List.of()
            : bookingRepository
                .findTop5ByCustomerEmailOrderByStartTimeDesc(email)
                .stream()
                .map(b -> new CustomerDetailDTO.RecentBookingDTO(
                    b.getBookingId(),
                    b.getStartTime(),
                    b.getBookingStatus().name(),
                    b.getService()       != null ? b.getService().getTitle()          : "—",
                    b.getServiceOption() != null ? b.getServiceOption().getName()     : null
                ))
                .toList();

        return new CustomerDetailDTO(
            customer.getCustomerId(),
            customer.getFullName(),
            customer.getPhone(),
            customer.getEmail(),
            packages,
            bookings
        );
    }
}