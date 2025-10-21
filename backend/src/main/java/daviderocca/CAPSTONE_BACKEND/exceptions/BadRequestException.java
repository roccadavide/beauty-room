package daviderocca.CAPSTONE_BACKEND.exceptions;

public class BadRequestException extends RuntimeException {
	public BadRequestException(String msg) {
		super(msg);
	}
}
