package daviderocca.beautyroom.services;

import daviderocca.beautyroom.DTO.customerDTOs.ArretratoLineDTO;
import daviderocca.beautyroom.DTO.customerDTOs.CreateCustomerDTO;
import daviderocca.beautyroom.DTO.customerDTOs.CustomerDetailDTO;
import daviderocca.beautyroom.DTO.customerDTOs.CustomerSummaryDTO;
import daviderocca.beautyroom.DTO.customerDTOs.UpdateCustomerDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.Customer;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.ClientPackageStatus;
import daviderocca.beautyroom.enums.PackageCreditStatus;
import daviderocca.beautyroom.exceptions.BadRequestException;
import daviderocca.beautyroom.exceptions.DuplicateResourceException;
import daviderocca.beautyroom.exceptions.ResourceNotFoundException;
import daviderocca.beautyroom.packages.ClientPackageAssignmentRepository;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.CustomerRepository;
import daviderocca.beautyroom.repositories.PackageCreditRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomerService {

    private static final String WALKIN_MARKER = "@beautyroom.local";

    private final CustomerRepository              customerRepository;
    private final PackageCreditRepository         packageCreditRepository;
    private final BookingRepository               bookingRepository;
    private final ClientPackageAssignmentRepository assignmentRepository;

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

    /**
     * Inline customer creation for the Admin Agenda drawer.
     *
     * Delegates to {@link #findOrCreate} on purpose: this is the SAME
     * deduplication path the booking-create flow uses, so a customer created
     * here and a booking submitted afterwards resolve to one record (keyed on
     * the unique phone). If the typed phone already belongs to an existing
     * customer, that record is returned idempotently rather than raising the
     * {@code ux_customer_phone} constraint — never a 500 on duplicate phone.
     */
    @Transactional
    public CustomerSummaryDTO create(CreateCustomerDTO payload) {
        Customer c = findOrCreate(payload.fullName(), payload.phone(), payload.email(), null);
        return new CustomerSummaryDTO(c.getCustomerId(), c.getFullName(), c.getPhone(), c.getEmail());
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

    @Transactional(readOnly = true)
    public CustomerDetailDTO getSummary(UUID customerId) {
        Customer customer = customerRepository.findById(customerId)
            .orElseThrow(() -> new ResourceNotFoundException(customerId));

        String email = customer.getEmail();
        // History + arretrati key on the NORMALIZED phone (digits-only): the salon is
        // walk-in-heavy, so email rarely identifies a returning client but the phone
        // does. Short-circuit when the phone has no digits — otherwise a phone-less
        // customer would match every other phone-less booking (the email-bug mirror).
        String phoneDigits = digitsOnly(customer.getPhone());
        boolean hasPhone = !phoneDigits.isEmpty();

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

        // ── Bookings: full history (order desc by startTime), keyed by phone ──
        List<CustomerDetailDTO.RecentBookingDTO> bookings = !hasPhone
            ? List.of()
            : bookingRepository
                .findByCustomerPhoneNormalizedOrderByStartTimeDesc(customer.getPhone())
                .stream()
                .map(b -> new CustomerDetailDTO.RecentBookingDTO(
                    b.getBookingId(),
                    b.getStartTime(),
                    b.getBookingStatus().name(),
                    b.getService()       != null ? b.getService().getTitle()      : "—",
                    b.getServiceOption() != null ? b.getServiceOption().getName() : null
                ))
                .toList();

        int total = bookings.size();
        int completed = (int) bookings.stream()
                .filter(b -> "COMPLETED".equals(b.bookingStatus()))
                .count();
        int cancelled = (int) bookings.stream()
                .filter(b -> "CANCELLED".equals(b.bookingStatus()) || "NO_SHOW".equals(b.bookingStatus()))
                .count();

        // ── Arretrati: derived unpaid lines on past COMPLETED bookings (no table) ──
        // Keyed by phone (digits-only); walk-ins have a phone but no real email.
        List<ArretratoLineDTO> arretrati = !hasPhone
            ? List.of()
            : bookingRepository.findArretratiForCustomer(customer.getPhone()).stream()
                .map(this::toArretrato)
                .toList();

        return new CustomerDetailDTO(
                customer.getCustomerId(),
                customer.getFullName(),
                customer.getPhone(),
                customer.getEmail(),
                customer.getNotes(),
                total,
                completed,
                cancelled,
                packages,
                bookings,
                arretrati
        );
    }

    /**
     * Arretrati for the customer of a given booking (resolved by the booking's phone) —
     * lazy-load for the agenda dropdown (GET /admin/bookings/{id}/arretrati). Reuses the
     * SAME enriched query and the SAME row mapper as getSummary, so the lines match exactly.
     */
    @Transactional(readOnly = true)
    public List<ArretratoLineDTO> getArretratiForBooking(UUID bookingId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(bookingId));
        if (digitsOnly(b.getCustomerPhone()).isEmpty()) return List.of();
        return bookingRepository.findArretratiForCustomer(b.getCustomerPhone()).stream()
                .map(this::toArretrato)
                .toList();
    }

    /** Maps one native row from findArretratiForCustomer to an ArretratoLineDTO. SINGLE
     *  source of truth for the row shape — used by getSummary AND getArretratiForBooking,
     *  so the two never drift in column order/coercion. */
    private ArretratoLineDTO toArretrato(Object[] r) {
        return new ArretratoLineDTO(
                asUuid(r[0]),
                asDateTime(r[1]),
                (String) r[2],
                asBigDecimal(r[3]),
                (String) r[4],
                asUuid(r[5]));
    }

    /** Digits-only phone (empty when null/blank/no digits). Mirrors the SQL
     *  regexp_replace([^0-9]) used by the phone-keyed history/arretrati queries. */
    private static String digitsOnly(String phone) {
        return phone == null ? "" : phone.replaceAll("[^0-9]", "");
    }

    // ── Native-row coercion helpers (BookingRepository.findArretratiForCustomer) ──
    private static UUID asUuid(Object o) {
        if (o == null) return null;
        if (o instanceof UUID u) return u;
        return UUID.fromString(o.toString());
    }

    private static LocalDateTime asDateTime(Object o) {
        if (o == null) return null;
        if (o instanceof java.sql.Timestamp t) return t.toLocalDateTime();
        if (o instanceof LocalDateTime ldt) return ldt;
        if (o instanceof java.time.Instant inst) return LocalDateTime.ofInstant(inst, java.time.ZoneId.systemDefault());
        return null;
    }

    private static BigDecimal asBigDecimal(Object o) {
        if (o == null) return null;
        if (o instanceof BigDecimal bd) return bd;
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return new BigDecimal(o.toString());
    }

    @Transactional(readOnly = true)
    public String getFullName(UUID customerId) {
        return customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException(customerId))
                .getFullName();
    }

    @Transactional(readOnly = true)
    public String getEmail(UUID customerId) {
        return customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException(customerId))
                .getEmail();
    }

    @Transactional
    public void updateNotes(UUID customerId, String notes) {
        Customer c = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException(customerId));
        c.setNotes(notes != null ? notes.trim() : null);
        customerRepository.save(c);
    }

    // ══════════════════════════════════════════════════════════════════════
    // DELETE
    // ══════════════════════════════════════════════════════════════════════

    @Transactional
    public void deleteCustomer(UUID id) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(id));

        boolean hasActiveBookings = customer.getBookings().stream()
                .anyMatch(b -> b.getBookingStatus() == BookingStatus.CONFIRMED
                        || b.getBookingStatus() == BookingStatus.PENDING_PAYMENT);
        if (hasActiveBookings) {
            throw new DuplicateResourceException(
                    "Impossibile eliminare: questa cliente ha appuntamenti attivi. Cancella prima tutti gli appuntamenti futuri.");
        }

        boolean hasActivePkgs = assignmentRepository.findByClientNameIgnoreCase(customer.getFullName())
                .stream()
                .anyMatch(a -> a.getStatus() == ClientPackageStatus.ACTIVE);
        if (hasActivePkgs) {
            throw new DuplicateResourceException(
                    "Impossibile eliminare: questa cliente ha pacchetti attivi. Cancella o esaurisci prima tutti i pacchetti.");
        }

        customerRepository.delete(customer);
        log.info("Customer deleted: {} ({})", customer.getFullName(), customer.getCustomerId());
    }

    @Transactional
    public CustomerSummaryDTO updateCustomer(UUID customerId, UpdateCustomerDTO payload) {
        Customer c = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException(customerId));
        if (payload.fullName() != null && !payload.fullName().isBlank()) {
            c.setFullName(payload.fullName().trim());
        }
        if (payload.phone() != null) {
            c.setPhone(payload.phone().isBlank() ? null : payload.phone().trim());
        }
        if (payload.email() != null) {
            c.setEmail(payload.email().isBlank() ? null : payload.email().trim().toLowerCase());
        }
        Customer saved = customerRepository.save(c);
        return new CustomerSummaryDTO(saved.getCustomerId(), saved.getFullName(), saved.getPhone(), saved.getEmail());
    }
}