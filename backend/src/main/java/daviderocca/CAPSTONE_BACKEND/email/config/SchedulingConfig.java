package daviderocca.CAPSTONE_BACKEND.email.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.client.RestTemplate;

@EnableScheduling
@Configuration
public class SchedulingConfig {

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}