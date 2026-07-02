package daviderocca.beautyroom;

import daviderocca.beautyroom.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.beautyroom.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.beautyroom.entities.Category;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentDTO;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentRequestDTO;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentService;
import daviderocca.beautyroom.repositories.CategoryRepository;
import daviderocca.beautyroom.repositories.ServiceItemRepository;
import daviderocca.beautyroom.repositories.UserRepository;
import daviderocca.beautyroom.services.BookingService;
import daviderocca.beautyroom.staff.StaffMember;
import daviderocca.beautyroom.staff.StaffMemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * P01 (multi-staff, acceptance): a created Booking and PersonalAppointment carry a
 * non-null staff_id through the REAL service write paths (DefaultStaffResolver wired
 * at the construction sites). The sale legs are unit-covered in BookingServiceTest.
 *
 * <p>H2 test profile creates the schema from entities (Flyway off), so the V82 seed
 * does not exist here — each test seeds its own active staff row. staff_id is read
 * back via JDBC to avoid touching the LAZY association outside a transaction.</p>
 */
@SpringBootTest
@ActiveProfiles("test")
class StaffDefaultAssignmentIntegrationTest {

    @Autowired private BookingService bookingService;
    @Autowired private PersonalAppointmentService personalAppointmentService;
    @Autowired private StaffMemberRepository staffMemberRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private ServiceItemRepository serviceItemRepository;
    @Autowired private JdbcTemplate jdbc;

    @BeforeEach
    void resetSchemaAndData() {
        // convertToDTO → loadServiceSummaries runs native SQL against booking_services
        // columns that live only in the Flyway schema — add them to the H2 schema so the
        // real query executes here (same recipe as ReportRevenueReconciliationTest).
        jdbc.execute("ALTER TABLE booking_services ADD COLUMN IF NOT EXISTS price_override DECIMAL(10,2)");
        jdbc.execute("ALTER TABLE booking_services ADD COLUMN IF NOT EXISTS option_id UUID");
        jdbc.execute("ALTER TABLE booking_services ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE");
        jdbc.execute("ALTER TABLE booking_services ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0");
        jdbc.execute("ALTER TABLE booking_services ADD COLUMN IF NOT EXISTS override_duration_min INT");

        // @SpringBootTest shares the H2 context and these tests commit — wipe the tables
        // this test writes so every run starts clean (users stays: AdminInitializer's admin).
        jdbc.execute("SET REFERENTIAL_INTEGRITY FALSE");
        for (String t : List.of(
                "booking_services", "booking_sales", "bookings", "personal_appointments",
                "staff_working_hours", "staff_services", "staff_members",
                "service_options", "services", "categories", "customers")) {
            try { jdbc.execute("DELETE FROM " + t); } catch (Exception ignore) { /* table may not exist */ }
        }
        jdbc.execute("SET REFERENTIAL_INTEGRITY TRUE");
    }

    @Test
    @DisplayName("P01: manual admin booking carries the single active staff")
    void manualAdminBooking_carriesDefaultStaff() {
        StaffMember staff = seedActiveStaff();
        ServiceItem svc = seedService();
        User admin = adminUser();

        LocalDateTime start = LocalDateTime.now().plusDays(1)
                .withHour(10).withMinute(0).withSecond(0).withNano(0);
        NewBookingDTO payload = new NewBookingDTO(
                "Mario Rossi", "mario.rossi@test.it", "+393471234567",
                start, "Nota P01",
                svc.getServiceId(), null, null, null,
                false, false,
                null, null, null, false);

        BookingResponseDTO dto = bookingService.createManualConfirmedBookingAsAdmin(payload, admin);

        UUID staffId = jdbc.queryForObject(
                "SELECT staff_id FROM bookings WHERE booking_id = ?", UUID.class, dto.bookingId());
        assertThat(staffId).isEqualTo(staff.getId());
    }

    @Test
    @DisplayName("P01: personal appointment carries the single active staff")
    void personalAppointment_carriesDefaultStaff() {
        StaffMember staff = seedActiveStaff();

        PersonalAppointmentDTO dto = personalAppointmentService.create(new PersonalAppointmentRequestDTO(
                "Palestra", null, LocalDate.now().plusDays(1), LocalTime.of(18, 0), 60, null), null);

        UUID staffId = jdbc.queryForObject(
                "SELECT staff_id FROM personal_appointments WHERE id = ?", UUID.class, dto.id());
        assertThat(staffId).isEqualTo(staff.getId());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private StaffMember seedActiveStaff() {
        return staffMemberRepository.save(new StaffMember("Michela", true, 0));
    }

    private ServiceItem seedService() {
        Category cat = categoryRepository.save(new Category("p01", "P01"));
        return serviceItemRepository.save(
                new ServiceItem("Trattamento P01", 30, new BigDecimal("50.00"), "short", "desc", List.of(), cat));
    }

    private User adminUser() {
        // Seeded at context boot by AdminInitializer (admin.* test properties).
        return userRepository.findByEmail("admin@test.local").orElseThrow();
    }
}
