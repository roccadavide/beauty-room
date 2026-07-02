package daviderocca.beautyroom;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import daviderocca.beautyroom.DTO.userDTOs.UserLoginDTO;
import daviderocca.beautyroom.entities.Booking;
import daviderocca.beautyroom.entities.Category;
import daviderocca.beautyroom.entities.ServiceItem;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.enums.BookingStatus;
import daviderocca.beautyroom.enums.Role;
import daviderocca.beautyroom.personalappointments.PersonalAppointment;
import daviderocca.beautyroom.personalappointments.PersonalAppointmentRepository;
import daviderocca.beautyroom.repositories.BookingRepository;
import daviderocca.beautyroom.repositories.CategoryRepository;
import daviderocca.beautyroom.repositories.ServiceItemRepository;
import daviderocca.beautyroom.repositories.UserRepository;
import daviderocca.beautyroom.staff.StaffMember;
import daviderocca.beautyroom.staff.StaffMemberRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prompt 03 — Team backend API acceptance (same MockMvc + real-login recipe as
 * StaffRbacIntegrationTest): staff creation atomicity + duplicate 409,
 * deactivation guard 409 with blocking list (decision #10), services
 * replace-set, staff hours upsert + §3.5 dual-write mirror in both directions,
 * public list qualification filter, PA own-only guard (matrix row 10) and
 * closure staffId semantics (decision #7).
 *
 * <p>Shared H2 context: every row this class creates is removed in
 * {@link #cleanUp()} so no state leaks into other test classes.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StaffTeamApiIntegrationTest {

    private static final String TEST_MAIL_DOMAIN = "@team03.test";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private StaffMemberRepository staffMemberRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private ServiceItemRepository serviceItemRepository;
    @Autowired private PersonalAppointmentRepository personalAppointmentRepository;
    @Autowired private JdbcTemplate jdbc;

    @Value("${admin.email}")
    private String adminEmail;
    @Value("${admin.password}")
    private String adminPassword;

    // Runs before AND after each test: the H2 context is shared across classes, so
    // stray staff/booking rows from elsewhere must not skew counts here, and rows
    // created here must not leak out.
    @BeforeEach
    void cleanBefore() {
        cleanUp();
    }

    @AfterEach
    void cleanUp() {
        jdbc.execute("SET REFERENTIAL_INTEGRITY FALSE");
        for (String t : List.of(
                "personal_appointments", "booking_services", "booking_sales", "bookings",
                "closures", "staff_working_hours", "staff_services", "staff_members",
                "service_options", "services", "categories")) {
            try { jdbc.execute("DELETE FROM " + t); } catch (Exception ignore) { /* table may not exist */ }
        }
        // Legacy hours rows written by the dual-write tests.
        jdbc.update("DELETE FROM working_hours WHERE day_of_week IN ('MONDAY','TUESDAY')");
        // Login users created through POST /admin/staff.
        jdbc.update("DELETE FROM users WHERE email LIKE ?", "%" + TEST_MAIL_DOMAIN);
        jdbc.execute("SET REFERENTIAL_INTEGRITY TRUE");
    }

    // ---------- staff creation: user + staff atomicity, duplicate email 409 ----------

    @Test
    @DisplayName("POST /admin/staff | creates STAFF user + staff row atomically, login works")
    void createStaff_createsUserAndStaffRow() throws Exception {
        String email = "giulia" + TEST_MAIL_DOMAIN;

        mockMvc.perform(post("/admin/staff")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newStaffBody("Giulia Bianchi", email, "+393401110001", "#AA22BB")))
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.displayName").value("Giulia Bianchi"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.color").value("#AA22BB"))
                .andExpect(jsonPath("$.userEmail").value(email));

        User created = userRepository.findByEmail(email).orElseThrow();
        assertThat(created.getRole()).isEqualTo(Role.STAFF);
        assertThat(created.isVerified()).isTrue();
        assertThat(staffMemberRepository.findByUser_UserId(created.getUserId())).isPresent();

        // the new account can actually log in (hashing reused from the register path)
        loginAndGetToken(email, "password123");
    }

    @Test
    @DisplayName("POST /admin/staff | duplicate email -> 409, neither user nor staff row created")
    void createStaff_duplicateEmail_conflict_atomic() throws Exception {
        String email = "dup" + TEST_MAIL_DOMAIN;
        String token = adminToken();

        mockMvc.perform(post("/admin/staff")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newStaffBody("Prima Staff", email, "+393401110002", null)))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());

        long usersBefore = userRepository.count();
        long staffBefore = staffMemberRepository.count();

        mockMvc.perform(post("/admin/staff")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newStaffBody("Seconda Staff", email, "+393401110003", null)))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());

        assertThat(userRepository.count()).isEqualTo(usersBefore);
        assertThat(staffMemberRepository.count()).isEqualTo(staffBefore);
    }

    @Test
    @DisplayName("POST /admin/staff | STAFF caller -> 403 (owner-only, matrix row 28)")
    void createStaff_staffCaller_forbidden() throws Exception {
        String staffToken = createStaffAndLogin("Op Prova", "op" + TEST_MAIL_DOMAIN, "+393401110004");

        mockMvc.perform(post("/admin/staff")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newStaffBody("Altra", "altra" + TEST_MAIL_DOMAIN, "+393401110005", null)))
                        .header("Authorization", "Bearer " + staffToken))
                .andExpect(status().isForbidden());
    }

    // ---------- deactivation guard (decision #10) ----------

    @Test
    @DisplayName("PATCH /admin/staff/{id}/active | future CONFIRMED booking -> 409 with blocking list; free staff deactivates; reactivation always allowed")
    void deactivation_blockedByFutureConfirmedBooking() throws Exception {
        String token = adminToken();
        StaffMember staff = staffMemberRepository.save(new StaffMember("Con Agenda", true, 1));

        LocalDateTime start = LocalDateTime.now().plusDays(3).withHour(10).withMinute(0).withSecond(0).withNano(0);
        Booking blocking = new Booking("Cliente Bloccante", "cb@test.it", "+393479998877",
                start, start.plusHours(1), null, null, null, null);
        blocking.setBookingStatus(BookingStatus.CONFIRMED);
        blocking.setStaffMember(staff);
        blocking = bookingRepository.save(blocking);

        mockMvc.perform(patch("/admin/staff/" + staff.getId() + "/active")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\": false}")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.details.blockingBookings", hasSize(1)))
                .andExpect(jsonPath("$.details.blockingBookings[0].bookingId").value(blocking.getBookingId().toString()))
                .andExpect(jsonPath("$.details.blockingBookings[0].customerName").value("Cliente Bloccante"));

        // still active
        assertThat(staffMemberRepository.findById(staff.getId()).orElseThrow().isActive()).isTrue();

        // cancelled bookings don't block
        blocking.setBookingStatus(BookingStatus.CANCELLED);
        bookingRepository.save(blocking);

        mockMvc.perform(patch("/admin/staff/" + staff.getId() + "/active")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\": false}")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        // reactivation always allowed
        mockMvc.perform(patch("/admin/staff/" + staff.getId() + "/active")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\": true}")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    // ---------- service assignments: replace-set ----------

    @Test
    @DisplayName("PUT /admin/staff/{id}/services | replace-set semantics")
    void services_replaceSet() throws Exception {
        String token = adminToken();
        StaffMember staff = staffMemberRepository.save(new StaffMember("Qualificata", true, 1));
        ServiceItem a = seedService("Manicure T03");
        ServiceItem b = seedService("Pedicure T03");

        mockMvc.perform(put("/admin/staff/" + staff.getId() + "/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("serviceIds",
                                List.of(a.getServiceId(), b.getServiceId()))))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceIds", hasSize(2)));

        // replace with a single service — the other assignment must disappear
        mockMvc.perform(put("/admin/staff/" + staff.getId() + "/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("serviceIds", List.of(b.getServiceId()))))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceIds", hasSize(1)))
                .andExpect(jsonPath("$.serviceIds[0]").value(b.getServiceId().toString()));

        mockMvc.perform(get("/admin/staff/" + staff.getId() + "/services")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceIds", hasSize(1)))
                .andExpect(jsonPath("$.serviceIds[0]").value(b.getServiceId().toString()));

        // unknown service id -> 404, set untouched
        mockMvc.perform(put("/admin/staff/" + staff.getId() + "/services")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("serviceIds", List.of(UUID.randomUUID()))))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    // ---------- working hours: upsert + §3.5 dual-write mirror both directions ----------

    @Test
    @DisplayName("Staff hours | owner row PUT mirrors into legacy working_hours; legacy PUT mirrors back")
    void workingHours_dualWrite_bothDirections() throws Exception {
        String token = adminToken();
        StaffMember owner = seedOwnerStaff();

        // staff -> legacy
        mockMvc.perform(put("/admin/staff/" + owner.getId() + "/working-hours")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(
                                hoursBody("MONDAY", "09:00", "12:30", "14:00", "19:00"))))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].dayOfWeek").value("MONDAY"))
                .andExpect(jsonPath("$[0].afternoonEnd").value("19:00"));

        String legacyJson = mockMvc.perform(get("/working-hours/day/MONDAY")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.morningStart").value("09:00"))
                .andExpect(jsonPath("$.afternoonEnd").value("19:00"))
                .andReturn().getResponse().getContentAsString();
        UUID legacyId = UUID.fromString(objectMapper.readTree(legacyJson).get("id").asText());

        // legacy -> staff
        mockMvc.perform(put("/working-hours/" + legacyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                hoursBody("MONDAY", "09:00", "12:30", "14:00", "18:00")))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(get("/admin/staff/" + owner.getId() + "/working-hours")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].afternoonEnd").value("18:00"));
    }

    @Test
    @DisplayName("Staff hours | non-owner staff PUT does NOT touch legacy working_hours")
    void workingHours_nonOwner_noLegacyMirror() throws Exception {
        String token = adminToken();
        seedOwnerStaff(); // owner exists, but the edited row is another staff's
        StaffMember other = staffMemberRepository.save(new StaffMember("Collaboratrice", true, 1));

        mockMvc.perform(put("/admin/staff/" + other.getId() + "/working-hours")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(
                                hoursBody("TUESDAY", "10:00", "13:00", null, null))))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].morningStart").value("10:00"));

        mockMvc.perform(get("/working-hours/day/TUESDAY")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    // ---------- public list: active + qualification filter, no auth ----------

    @Test
    @DisplayName("GET /api/public/staff | active only, sort_order, serviceId qualification filter")
    void publicStaffList_filtersByActiveAndQualification() throws Exception {
        String token = adminToken();
        StaffMember qualified = staffMemberRepository.save(new StaffMember("Michela", true, 0));
        StaffMember unqualified = staffMemberRepository.save(new StaffMember("Giulia", true, 1));
        StaffMember inactive = staffMemberRepository.save(new StaffMember("Ex Collega", false, 2));
        ServiceItem svc = seedService("Laser T03");

        for (StaffMember s : List.of(qualified, inactive)) {
            mockMvc.perform(put("/admin/staff/" + s.getId() + "/services")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("serviceIds", List.of(svc.getServiceId()))))
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk());
        }

        // no auth header: the endpoint is public
        mockMvc.perform(get("/api/public/staff"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].displayName").value("Michela"))
                .andExpect(jsonPath("$[1].displayName").value("Giulia"));

        mockMvc.perform(get("/api/public/staff").param("serviceId", svc.getServiceId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(qualified.getId().toString()));
    }

    // ---------- personal appointments: staffId + own-only guard (matrix row 10) ----------

    @Test
    @DisplayName("PA | STAFF writes own only (explicit + default), owner writes any, staffId list filter")
    void personalAppointments_staffScope() throws Exception {
        String adminTok = adminToken();
        String staffTok = createStaffAndLogin("Operatrice Pa", "pa" + TEST_MAIL_DOMAIN, "+393401110006");
        UUID ownStaffId = staffIdOfUser("pa" + TEST_MAIL_DOMAIN);
        StaffMember other = staffMemberRepository.save(new StaffMember("Altra Collega", true, 5));

        // STAFF targeting another staff -> 403
        mockMvc.perform(post("/admin/personal-appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(paBody("Palestra", other.getId())))
                        .header("Authorization", "Bearer " + staffTok))
                .andExpect(status().isForbidden());

        // STAFF explicit own -> 201
        mockMvc.perform(post("/admin/personal-appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(paBody("Dentista", ownStaffId)))
                        .header("Authorization", "Bearer " + staffTok))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.staffId").value(ownStaffId.toString()));

        // STAFF without staffId -> defaults to own staff row
        mockMvc.perform(post("/admin/personal-appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(paBody("Commissioni", null)))
                        .header("Authorization", "Bearer " + staffTok))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.staffId").value(ownStaffId.toString()));

        // owner (ADMIN) writes for anyone
        mockMvc.perform(post("/admin/personal-appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(paBody("Corso", other.getId())))
                        .header("Authorization", "Bearer " + adminTok))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.staffId").value(other.getId().toString()));

        // STAFF cannot update/delete another staff's PA
        PersonalAppointment othersPa = personalAppointmentRepository
                .findByAppointmentDateAndStaffMember_IdOrderByStartTime(paDate(), other.getId()).get(0);
        mockMvc.perform(put("/admin/personal-appointments/" + othersPa.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(paBody("Hijack", null)))
                        .header("Authorization", "Bearer " + staffTok))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/admin/personal-appointments/" + othersPa.getId())
                        .header("Authorization", "Bearer " + staffTok))
                .andExpect(status().isForbidden());

        // list filter: only the requested staff's rows
        mockMvc.perform(get("/admin/personal-appointments")
                        .param("date", paDate().toString())
                        .param("staffId", other.getId().toString())
                        .header("Authorization", "Bearer " + adminTok))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title").value("Corso"));

        // unfiltered day view still returns everything (3 rows)
        mockMvc.perform(get("/admin/personal-appointments")
                        .param("date", paDate().toString())
                        .header("Authorization", "Bearer " + adminTok))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)));
    }

    // ---------- closures: staffId semantics (decision #7) ----------

    @Test
    @DisplayName("Closures | staff absence carries staffId; two staff same-day absences coexist; preview scoped per staff")
    void closures_staffAbsenceSemantics() throws Exception {
        String token = adminToken();
        StaffMember staff1 = staffMemberRepository.save(new StaffMember("Michela", true, 0));
        StaffMember staff2 = staffMemberRepository.save(new StaffMember("Giulia", true, 1));
        LocalDate day = LocalDate.now().plusDays(10);

        // booking for staff1 on that day (preview fixture)
        LocalDateTime start = day.atTime(10, 0);
        Booking b = new Booking("Cliente Preview", "cp@test.it", "+393478887766",
                start, start.plusHours(1), null, null, null, null);
        b.setBookingStatus(BookingStatus.CONFIRMED);
        b.setStaffMember(staff1);
        bookingRepository.save(b);

        // staff1 absence
        mockMvc.perform(post("/closures")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(closureBody(day, "Ferie Michela", staff1.getId())))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.staffId").value(staff1.getId().toString()));

        // a DIFFERENT staff's absence on the same day must not conflict
        mockMvc.perform(post("/closures")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(closureBody(day, "Ferie Giulia", staff2.getId())))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.staffId").value(staff2.getId().toString()));

        // a salon-wide closure on the same day DOES conflict (scope intersects)
        mockMvc.perform(post("/closures")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(closureBody(day, "Chiusura totale", null)))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());

        // preview: staff1 has 1 overlapping booking, staff2 none
        LocalDate previewDay = day.plusDays(1);
        LocalDateTime pStart = previewDay.atTime(15, 0);
        Booking b2 = new Booking("Cliente Preview 2", "cp2@test.it", "+393478887755",
                pStart, pStart.plusHours(1), null, null, null, null);
        b2.setBookingStatus(BookingStatus.CONFIRMED);
        b2.setStaffMember(staff1);
        bookingRepository.save(b2);

        mockMvc.perform(post("/closures/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(closureBody(previewDay, "preview", staff1.getId())))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.overlappingBookingsCount").value(1));

        mockMvc.perform(post("/closures/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(closureBody(previewDay, "preview", staff2.getId())))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.overlappingBookingsCount").value(0));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Map<String, Object> newStaffBody(String displayName, String email, String phone, String color) {
        Map<String, Object> body = new HashMap<>();
        body.put("displayName", displayName);
        body.put("email", email);
        body.put("password", "password123");
        body.put("phone", phone);
        if (color != null) body.put("color", color);
        return body;
    }

    private Map<String, Object> hoursBody(String day, String mStart, String mEnd, String aStart, String aEnd) {
        Map<String, Object> body = new HashMap<>();
        body.put("dayOfWeek", day);
        body.put("closed", false);
        body.put("morningStart", mStart);
        body.put("morningEnd", mEnd);
        if (aStart != null) body.put("afternoonStart", aStart);
        if (aEnd != null) body.put("afternoonEnd", aEnd);
        return body;
    }

    private LocalDate paDate() {
        return LocalDate.now().plusDays(5);
    }

    private Map<String, Object> paBody(String title, UUID staffId) {
        Map<String, Object> body = new HashMap<>();
        body.put("title", title);
        body.put("appointmentDate", paDate().toString());
        body.put("startTime", "18:00");
        body.put("durationMinutes", 60);
        if (staffId != null) body.put("staffId", staffId.toString());
        return body;
    }

    private Map<String, Object> closureBody(LocalDate day, String reason, UUID staffId) {
        Map<String, Object> body = new HashMap<>();
        body.put("startDate", day.toString());
        body.put("endDate", day.toString());
        body.put("reason", reason);
        if (staffId != null) body.put("staffId", staffId.toString());
        return body;
    }

    private ServiceItem seedService(String name) {
        Category cat = categoryRepository.save(new Category("t03-" + name.hashCode(), "T03 " + name));
        return serviceItemRepository.save(
                new ServiceItem(name, 30, new BigDecimal("50.00"), "short", "desc", List.of(), cat));
    }

    private StaffMember seedOwnerStaff() {
        User admin = userRepository.findByEmail(adminEmail).orElseThrow();
        StaffMember owner = new StaffMember("Michela", true, 0);
        owner.setUser(admin);
        return staffMemberRepository.save(owner);
    }

    /** Creates a staff member through the real API and returns a logged-in token for it. */
    private String createStaffAndLogin(String displayName, String email, String phone) throws Exception {
        mockMvc.perform(post("/admin/staff")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newStaffBody(displayName, email, phone, null)))
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isCreated());
        return loginAndGetToken(email, "password123");
    }

    private UUID staffIdOfUser(String email) {
        User user = userRepository.findByEmail(email).orElseThrow();
        return staffMemberRepository.findByUser_UserId(user.getUserId()).orElseThrow().getId();
    }

    private String adminToken() throws Exception {
        return loginAndGetToken(adminEmail, adminPassword);
    }

    private String loginAndGetToken(String email, String password) throws Exception {
        UserLoginDTO credentials = new UserLoginDTO(email, password, true);
        String body = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(credentials)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(body);
        return node.get("accessToken").asText();
    }
}
