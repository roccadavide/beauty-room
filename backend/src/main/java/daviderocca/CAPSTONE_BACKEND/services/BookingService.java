package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.BookingResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.bookingDTOs.NewBookingDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceItem;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.exceptions.UnauthorizedException;
import daviderocca.CAPSTONE_BACKEND.repositories.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;

    private final ServiceItemService serviceItemService;

    // ---------------------------- FIND METHODS ----------------------------
    @Transactional(readOnly = true)
    public Page<BookingResponseDTO> findAllBookings(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<Booking> page = bookingRepository.findAll(pageable);
        return page.map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    public Booking findBookingById(UUID bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException(bookingId));
    }

    @Transactional(readOnly = true)
    public BookingResponseDTO findBookingByIdAndConvert(UUID bookingId) {
        Booking found = findBookingById(bookingId);
        return convertToDTO(found);
    }

    @Transactional(readOnly = true)
    public List<BookingResponseDTO> findBookingByEmailAndConvert(String customerEmail) {
        return bookingRepository.findByCustomerEmail(customerEmail)
                .stream()
                .map(this::convertToDTO)
                .toList();
    }

    // ---------------------------------- CREATE ----------------------------------
    @Transactional
    public BookingResponseDTO saveBooking(NewBookingDTO payload, User currentUser) {

        // Validazioni orari
        if (payload.startTime().isAfter(payload.endTime())) {
            throw new BadRequestException("L'orario di inizio non può essere successivo a quello di fine.");
        }

        if (payload.startTime().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("L'orario di inizio non può essere nel passato.");
        }

        // Controllo sovrapposizioni
        if (!bookingRepository.findOverlappingBookings(payload.serviceId(), payload.startTime(), payload.endTime()).isEmpty()) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo per il servizio scelto.");
        }

        ServiceItem serviceItem = serviceItemService.findServiceItemById(payload.serviceId());

        Booking newBooking = new Booking(
                payload.customerName(),
                payload.customerEmail(),
                payload.customerPhone(),
                payload.startTime(),
                payload.endTime(),
                payload.notes(),
                serviceItem,
                currentUser
        );

        Booking savedBooking = bookingRepository.save(newBooking);
        log.info("Prenotazione {} creata correttamente (stato: {}).",
                savedBooking.getBookingId(), savedBooking.getBookingStatus());

        return convertToDTO(savedBooking);
    }

    // ---------------------------------- UPDATE ----------------------------------
    @Transactional
    public BookingResponseDTO updateBooking(UUID idBooking, NewBookingDTO payload, User currentUser) {
        Booking found = findBookingById(idBooking);

        if (found.getBookingStatus() == BookingStatus.CANCELLED || found.getBookingStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Non puoi modificare una prenotazione già " + found.getBookingStatus());
        }

        if (payload.startTime().isAfter(payload.endTime())) {
            throw new BadRequestException("L'orario di inizio non può essere successivo a quello di fine.");
        }

        if (!bookingRepository.findOverlappingBookings(payload.serviceId(), payload.startTime(), payload.endTime()).isEmpty()) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo per il servizio scelto.");
        }

        ServiceItem relatedService = serviceItemService.findServiceItemById(payload.serviceId());

        found.setCustomerName(payload.customerName());
        found.setCustomerEmail(payload.customerEmail());
        found.setCustomerPhone(payload.customerPhone());
        found.setStartTime(payload.startTime());
        found.setEndTime(payload.endTime());
        found.setNotes(payload.notes());
        found.setService(relatedService);
        found.setUser(currentUser);

        Booking updated = bookingRepository.save(found);
        log.info("Prenotazione {} aggiornata correttamente.", updated.getBookingId());

        return convertToDTO(updated);
    }

    // ---------------------------------- UPDATE STATUS ----------------------------------
    @Transactional
    public BookingResponseDTO updateBookingStatus(UUID bookingId, BookingStatus newStatus) {
        Booking found = findBookingById(bookingId);

        if (found.getBookingStatus() == BookingStatus.CANCELLED || found.getBookingStatus() == BookingStatus.COMPLETED) {
            throw new BadRequestException("Non puoi aggiornare lo stato di una prenotazione già " + found.getBookingStatus());
        }

        found.setBookingStatus(newStatus);
        Booking updated = bookingRepository.save(found);

        log.info("Stato prenotazione {} aggiornato a {}.", updated.getBookingId(), updated.getBookingStatus());
        return convertToDTO(updated);
    }

    // ---------------------------------- DELETE ----------------------------------
    @Transactional
    public void deleteBooking(UUID idBooking, User currentUser) {
        Booking found = findBookingById(idBooking);

        boolean isAdmin = currentUser.getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_ADMIN"));

        if (!isAdmin && (found.getUser() == null || !found.getUser().getUserId().equals(currentUser.getUserId()))) {
            throw new UnauthorizedException("Non puoi cancellare una prenotazione non tua.");
        }

        if (found.getStartTime().isBefore(LocalDateTime.now().plusHours(24))) {
            throw new BadRequestException("Puoi cancellare la prenotazione solo fino a 24 ore prima.");
        }

        bookingRepository.delete(found);
        log.info("Prenotazione {} eliminata correttamente.", found.getBookingId());
    }

    // ---------------------------------- CONVERTER ----------------------------------
    private BookingResponseDTO convertToDTO(Booking booking) {
        return new BookingResponseDTO(
                booking.getBookingId(),
                booking.getCustomerName(),
                booking.getCustomerEmail(),
                booking.getCustomerPhone(),
                booking.getStartTime(),
                booking.getEndTime(),
                booking.getBookingStatus(),
                booking.getNotes(),
                booking.getCreatedAt(),
                booking.getService() != null ? booking.getService().getServiceId() : null,
                booking.getUser() != null ? booking.getUser().getUserId() : null
        );
    }
}