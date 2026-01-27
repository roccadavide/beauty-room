package daviderocca.CAPSTONE_BACKEND.email.provider;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
public class MailgunSender {

    @Value("${mailgun.apiKey}") private String apiKey;
    @Value("${mailgun.domain}") private String domain;
    @Value("${mailgun.from}") private String from;

    private final RestTemplate restTemplate;

    public String sendHtml(String to, String subject, String html, String text) {

        String url = "https://api.mailgun.net/v3/" + domain + "/messages";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth("api", apiKey);

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