package daviderocca.CAPSTONE_BACKEND;

import com.fasterxml.jackson.databind.ObjectMapper;
import daviderocca.CAPSTONE_BACKEND.DTO.userDTOs.UserLoginDTO;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.Role;
import daviderocca.CAPSTONE_BACKEND.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
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

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrdersSecurityIntegrationTest {

    private static final String CUSTOMER_EMAIL = "customer@test.local";
    private static final String CUSTOMER_PASSWORD = "customer123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${admin.email}")
    private String adminEmail;

    @Value("${admin.password}")
    private String adminPassword;

    @BeforeEach
    void setUp() {
        if (userRepository.findByEmail(CUSTOMER_EMAIL).isEmpty()) {
            User customer = new User("Customer", "Test", CUSTOMER_EMAIL, passwordEncoder.encode(CUSTOMER_PASSWORD), "+393339998877");
            customer.setRole(Role.CUSTOMER);
            userRepository.save(customer);
        }
    }

    @Test
    void getOrders_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/orders"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getOrders_withCustomerToken_returns403() throws Exception {
        String token = loginAndGetToken(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

        mockMvc.perform(get("/orders")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void getOrders_withAdminToken_returns200() throws Exception {
        String token = loginAndGetToken(adminEmail, adminPassword);

        mockMvc.perform(get("/orders")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    private String loginAndGetToken(String email, String password) throws Exception {
        UserLoginDTO credentials = new UserLoginDTO(email, password);
        ResultActions result = mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(credentials)))
                .andExpect(status().isOk());

        String body = result.andReturn().getResponse().getContentAsString();
        Map<?, ?> map = objectMapper.readValue(body, Map.class);
        return (String) map.get("accessToken");
    }
}
