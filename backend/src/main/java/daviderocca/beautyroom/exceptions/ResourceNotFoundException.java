package daviderocca.beautyroom.exceptions;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.UUID;

@ResponseStatus(HttpStatus.NOT_FOUND) // 404
public class ResourceNotFoundException extends RuntimeException {

	public ResourceNotFoundException(UUID id) {
		super("La risorsa con id " + id + " non è stata trovata!");
	}

	public ResourceNotFoundException(String message) {
		super(message);
	}
}
