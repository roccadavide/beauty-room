package daviderocca.CAPSTONE_BACKEND.email.provider;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
@Slf4j
public class MailgunSender {

    @Value("${mailgun.apiKey}") private String apiKey;
    @Value("${mailgun.domain}") private String domain;
    @Value("${mailgun.from}") private String from;

    @Value("${mailgun.baseUrl:https://api.mailgun.net}")
    private String baseUrl;

    private final RestTemplate restTemplate;

    @PostConstruct
    void bootLog() {
        String k = (apiKey == null) ? "" : apiKey;
        log.info("MAILGUN loaded | baseUrl={} domain={} from={} apiKeyPresent={} apiKeyLen={}",
                baseUrl, domain, from, !k.isBlank(), k.length());
    }

    public String sendHtml(String to, String subject, String html, String text) {

        String url = baseUrl + "/v3/" + domain + "/messages";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth("api", apiKey.trim());

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("from", from);
        body.add("to", to);
        body.add("subject", subject);
        body.add("text", text != null ? text : "");
        body.add("html", html != null ? html : "");

        HttpEntity<MultiValueMap<String, String>> req = new HttpEntity<>(body, headers);

        ResponseEntity<String> res = restTemplate.postForEntity(url, req, String.class);
        if (!res.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("Mailgun error: " + res.getStatusCode() + " - " + res.getBody());
        }
        return res.getBody();
    }
}