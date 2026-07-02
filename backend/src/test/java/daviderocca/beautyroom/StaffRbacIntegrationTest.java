package daviderocca.beautyroom;

import com.fasterxml.jackson.databind.ObjectMapper;
import daviderocca.beautyroom.DTO.userDTOs.UserLoginDTO;
import daviderocca.beautyroom.entities.User;
import daviderocca.beautyroom.entities.WorkingHours;
import daviderocca.beautyroom.enums.Role;
import daviderocca.beautyroom.repositories.UserRepository;
import daviderocca.beautyroom.repositories.WorkingHoursRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prompt 02 — representative endpoint checks of the §2.2 permission matrix
 * (same MockMvc + real-login recipe as OrdersSecurityIntegrationTest).
 *
 * <p>STAFF must pass the daily-ops endpoints (agenda read, settle, clients hub,
 * orders handling) and be rejected by the owner-only ones (hard delete, refunds,
 * customer delete, reports, catalog writes, user admin). ADMIN behavior is
 * asserted unchanged. "Allowed" write paths on missing resources answer 404 —
 * which proves authorization passed both the annotation and the service guard.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StaffRbacIntegrationTest {

    private static final String STAFF_EMAIL = "staff.rbac@test.local";
    private static final String STAFF_PASSWORD = "staff123";
    private static final String CUSTOMER_EMAIL = "customer.rbac@test.local";
    private static final String CUSTOMER_PASSWORD = "customer123";
    private static final LocalDate TEST_DATE = LocalDate.of(2026, 7, 2);

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private StaffMemberRepository staffMemberRepository;
    @Autowired
    private WorkingHoursRepository workingHoursRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${admin.email}")
    private String adminEmail;
    @Value("${admin.password}")
    private String adminPassword;

    @BeforeEach
    void setUp() {
        seedUser(STAFF_EMAIL, STAFF_PASSWORD, "+393330001122", Role.STAFF);
        seedUser(CUSTOMER_EMAIL, CUSTOMER_PASSWORD, "+393330003344", Role.CUSTOMER);
    }

    @AfterEach
    void cleanUpSeededRows() {
        // Rows created here must not leak into other test classes (the H2 context is
        // shared, and DefaultStaffResolver / availability logic key off these tables).
        userRepository.findByEmail(STAFF_EMAIL)
                .flatMap(u -> staffMemberRepository.findByUser_UserId(u.getUserId()))
                .ifPresent(staffMemberRepository::delete);
        workingHoursRepository.findByDayOfWeek(TEST_DATE.getDayOfWeek())
                .ifPresent(workingHoursRepository::delete);
    }

    // ---------- STAFF: shared daily-ops capabilities ----------

    @Test
    @DisplayName("STAFF | agenda day read -> 200 (matrix row 1)")
    void staff_agendaDay_ok() throws Exception {
        mockMvc.perform(get("/admin/bookings/day").param("date", "2026-07-02")
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("STAFF | admin timeline day -> 200 (matrix row 1)")
    void staff_timelineDay_ok() throws Exception {
        seedWorkingHoursForTestDate();
        mockMvc.perform(get("/availabilities/admin/timeline/day").param("date", TEST_DATE.toString())
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("STAFF | clients hub search -> 200 (matrix row 12)")
    void staff_customersSearch_ok() throws Exception {
        mockMvc.perform(get("/admin/customers/search").param("q", "x")
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("STAFF | personal appointments day read -> 200 (matrix row 9)")
    void staff_personalAppointments_ok() throws Exception {
        mockMvc.perform(get("/admin/personal-appointments").param("date", "2026-07-02")
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("STAFF | installments due feed -> 200 (matrix row 4)")
    void staff_installmentsDue_ok() throws Exception {
        mockMvc.perform(get("/admin/package-installments/due")
                        .param("from", "2026-07-02").param("to", "2026-07-02")
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("STAFF | settle -> authorized through both layers (404 on missing booking, not 403)")
    void staff_settle_authorized() throws Exception {
        mockMvc.perform(patch("/admin/bookings/" + UUID.randomUUID() + "/settle")
                        .contentType(MediaType.APPLICATION_JSON).content("{}")
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("STAFF | orders list -> 200 (matrix row 13)")
    void staff_ordersList_ok() throws Exception {
        mockMvc.perform(get("/orders")
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isOk());
    }

    // ---------- STAFF: owner-only capabilities stay closed ----------

    @Test
    @DisplayName("STAFF | booking hard delete -> 403 (matrix row 5)")
    void staff_hardDeleteBooking_forbidden() throws Exception {
        mockMvc.perform(delete("/admin/bookings/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("STAFF | booking refund -> 403 (matrix row 6)")
    void staff_refundBooking_forbidden() throws Exception {
        mockMvc.perform(post("/admin/bookings/" + UUID.randomUUID() + "/refund")
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("STAFF | customer delete -> 403 (fail-closed override on shared controller)")
    void staff_deleteCustomer_forbidden() throws Exception {
        mockMvc.perform(delete("/admin/customers/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("STAFF | report -> 403 (matrix row 23: none in v1)")
    void staff_report_forbidden() throws Exception {
        mockMvc.perform(get("/admin/report")
                        .param("from", "2026-01-01").param("to", "2026-01-31")
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("STAFF | users admin list -> 403 (matrix row 27)")
    void staff_usersList_forbidden() throws Exception {
        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("STAFF | catalog write (service-item delete) -> 403 (matrix row 15)")
    void staff_serviceItemDelete_forbidden() throws Exception {
        mockMvc.perform(delete("/service-items/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("STAFF | order refund -> 403 (matrix row 6)")
    void staff_orderRefund_forbidden() throws Exception {
        mockMvc.perform(post("/orders/" + UUID.randomUUID() + "/refund")
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("STAFF | order hard delete -> 403 (destructive)")
    void staff_orderDelete_forbidden() throws Exception {
        mockMvc.perform(delete("/orders/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isForbidden());
    }

    // ---------- Controls: CUSTOMER blocked, ADMIN unchanged ----------

    @Test
    @DisplayName("CUSTOMER | agenda day read -> 403")
    void customer_agendaDay_forbidden() throws Exception {
        mockMvc.perform(get("/admin/bookings/day").param("date", "2026-07-02")
                        .header("Authorization", "Bearer " + loginAndGetToken(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("ADMIN | agenda day read -> 200 (unchanged)")
    void admin_agendaDay_ok() throws Exception {
        mockMvc.perform(get("/admin/bookings/day").param("date", "2026-07-02")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("ADMIN | hard delete stays authorized (404 on missing booking, not 403)")
    void admin_hardDelete_authorized() throws Exception {
        mockMvc.perform(delete("/admin/bookings/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("ADMIN | users admin list -> 200 (unchanged)")
    void admin_usersList_ok() throws Exception {
        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk());
    }

    // ---------- /users/me: additive staffId/staffName ----------

    @Test
    @DisplayName("/users/me | no staff row -> staffId null (additive field)")
    void me_withoutStaffRow_hasNullStaffId() throws Exception {
        mockMvc.perform(get("/users/me")
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.staffId").value(nullValue()))
                .andExpect(jsonPath("$.staffName").value(nullValue()));
    }

    @Test
    @DisplayName("/users/me | linked staff row -> staffId + staffName populated")
    void me_withStaffRow_exposesStaffIdentity() throws Exception {
        User staffUser = userRepository.findByEmail(STAFF_EMAIL).orElseThrow();
        StaffMember row = new StaffMember("Giulia", true, 1);
        row.setUser(staffUser);
        row = staffMemberRepository.save(row);

        mockMvc.perform(get("/users/me")
                        .header("Authorization", "Bearer " + staffToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.staffId").value(row.getId().toString()))
                .andExpect(jsonPath("$.staffName").value("Giulia"));
    }

    // ---------- helpers ----------

    private void seedWorkingHoursForTestDate() {
        DayOfWeek dow = TEST_DATE.getDayOfWeek();
        if (workingHoursRepository.findByDayOfWeek(dow).isEmpty()) {
            workingHoursRepository.save(new WorkingHours(
                    dow, LocalTime.of(9, 0), LocalTime.of(12, 30), LocalTime.of(14, 0), LocalTime.of(19, 0), false));
        }
    }

    private void seedUser(String email, String rawPassword, String phone, Role role) {
        if (userRepository.findByEmail(email).isEmpty()) {
            User user = new User(role.name(), "Rbac", email, passwordEncoder.encode(rawPassword), phone);
            user.setRole(role);
            userRepository.save(user);
        }
    }

    private String staffToken() throws Exception {
        return loginAndGetToken(STAFF_EMAIL, STAFF_PASSWORD);
    }

    private String adminToken() throws Exception {
        return loginAndGetToken(adminEmail, adminPassword);
    }

    private String loginAndGetToken(String email, String password) throws Exception {
        UserLoginDTO credentials = new UserLoginDTO(email, password, true);
        ResultActions result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(credentials)))
                .andExpect(status().isOk());

        String body = result.andReturn().getResponse().getContentAsString();
        Map<?, ?> map = objectMapper.readValue(body, Map.class);
        return (String) map.get("accessToken");
    }
}
