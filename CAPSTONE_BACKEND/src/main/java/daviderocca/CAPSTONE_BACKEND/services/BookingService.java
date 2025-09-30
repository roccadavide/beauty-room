package daviderocca.CAPSTONE_BACKEND.services;

import daviderocca.CAPSTONE_BACKEND.DTO.BookingResponseDTO;
import daviderocca.CAPSTONE_BACKEND.DTO.NewBookingDTO;
import daviderocca.CAPSTONE_BACKEND.entities.Booking;
import daviderocca.CAPSTONE_BACKEND.entities.ServiceItem;
import daviderocca.CAPSTONE_BACKEND.entities.User;
import daviderocca.CAPSTONE_BACKEND.enums.BookingStatus;
import daviderocca.CAPSTONE_BACKEND.enums.Role;
import daviderocca.CAPSTONE_BACKEND.exceptions.BadRequestException;
import daviderocca.CAPSTONE_BACKEND.exceptions.DuplicateResourceException;
import daviderocca.CAPSTONE_BACKEND.exceptions.ResourceNotFoundException;
import daviderocca.CAPSTONE_BACKEND.exceptions.UnauthorizedException;
import daviderocca.CAPSTONE_BACKEND.repositories.BookingRepository;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class BookingService {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private ServiceItemService serviceItemService;

    @Autowired
    private UserService userService;

    public Page<BookingResponseDTO> findAllBookings(int pageNumber, int pageSize, String sort) {
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(sort));
        Page<Booking> page = this.bookingRepository.findAll(pageable);

        return page.map(booking -> new BookingResponseDTO(
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
        ));
    }



    public Booking findBookingById(UUID bookingId) {
        return this.bookingRepository.findById(bookingId).orElseThrow(()-> new ResourceNotFoundException(bookingId));
    }

    public BookingResponseDTO findBookingByIdAndConvert(UUID bookingId) {
        Booking found = this.bookingRepository.findById(bookingId).orElseThrow(()-> new ResourceNotFoundException(bookingId));

        return new BookingResponseDTO(
                found.getBookingId(),
                found.getCustomerName(),
                found.getCustomerEmail(),
                found.getCustomerPhone(),
                found.getStartTime(),
                found.getEndTime(),
                found.getBookingStatus(),
                found.getNotes(),
                found.getCreatedAt(),
                found.getService() != null ? found.getService().getServiceId() : null,
                found.getUser() != null ? found.getUser().getUserId() : null
        );
    }


    public List<BookingResponseDTO> findBookingByEmailAndConvert(String customerEmail) {
        List<Booking> bookings = this.bookingRepository.findByCustomerEmail(customerEmail);

        return bookings.stream()
                .map(b -> new BookingResponseDTO(
                        b.getBookingId(),
                        b.getCustomerName(),
                        b.getCustomerEmail(),
                        b.getCustomerPhone(),
                        b.getStartTime(),
                        b.getEndTime(),
                        b.getBookingStatus(),
                        b.getNotes(),
                        b.getCreatedAt(),
                        b.getService() != null ? b.getService().getServiceId() : null,
                        b.getUser() != null ? b.getUser().getUserId() : null
                ))
                .toList();
    }

    public BookingResponseDTO saveBooking(NewBookingDTO payload, User currentUser) {

        if (payload.startTime().isAfter(payload.endTime())) {
            throw new BadRequestException("L'orario di inizio non può essere successivo a quello di fine!");
        }

        if (payload.startTime().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("L'orario di inizio non può essere nel passato!");
        }

        if (!bookingRepository.findOverlappingBookings(payload.serviceId(), payload.startTime(), payload.endTime()).isEmpty()) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo per il servizio scelto!");
        }

        ServiceItem relatedServiceItem = serviceItemService.findServiceItemById(payload.serviceId());


        Booking newBooking =  new Booking(payload.customerName(), payload.customerEmail(), payload.customerPhone(), payload.startTime(),
                payload.endTime(), payload.notes(), relatedServiceItem, currentUser);

        Booking savedNewBooking = this.bookingRepository.save(newBooking);
        log.info("La prenotazione {} dell'utente con email {} è stata salvata!",
                savedNewBooking.getBookingId(), savedNewBooking.getCustomerEmail());


        return new BookingResponseDTO(savedNewBooking.getBookingId(),
                savedNewBooking.getCustomerName(),
                savedNewBooking.getCustomerEmail(),
                savedNewBooking.getCustomerPhone(),
                savedNewBooking.getStartTime(),
                savedNewBooking.getEndTime(),
                savedNewBooking.getBookingStatus(),
                savedNewBooking.getNotes(),
                savedNewBooking.getCreatedAt(),
                payload.serviceId(),
                savedNewBooking.getUser() != null ? savedNewBooking.getUser().getUserId() : null
        );
    }


    @Transactional
    public BookingResponseDTO findBookingByIdAndUpdate (UUID idBooking, NewBookingDTO payload, User currentUser) {
        Booking found = findBookingById(idBooking);

        if (found.getBookingStatus().name().equals("CANCELLED") ||
                found.getBookingStatus().name().equals("COMPLETED")) {
            throw new BadRequestException("Non puoi modificare una prenotazione già " + found.getBookingStatus());
        }

        if (payload.startTime().isAfter(payload.endTime())) {
            throw new BadRequestException("L'orario di inizio non può essere successivo a quello di fine!");
        }

        if (!bookingRepository.findOverlappingBookings(payload.serviceId(), payload.startTime(), payload.endTime()).isEmpty()) {
            throw new BadRequestException("Esiste già una prenotazione in questo intervallo per il servizio scelto!");
        }

        ServiceItem relatedServiceItem = serviceItemService.findServiceItemById(payload.serviceId());

        found.setCustomerName(payload.customerName());
        found.setCustomerEmail(payload.customerEmail());
        found.setCustomerPhone(payload.customerPhone());
        found.setStartTime(payload.startTime());
        found.setEndTime(payload.endTime());
        found.setNotes(payload.notes());
        found.setService(relatedServiceItem);
        found.setUser(currentUser);

        Booking updatedBooking = this.bookingRepository.save(found);

        log.info("La prenotazione {} è stata aggiornata!", updatedBooking.getBookingId());

        return new BookingResponseDTO(updatedBooking.getBookingId(), updatedBooking.getCustomerName(),
                updatedBooking.getCustomerEmail(), updatedBooking.getCustomerPhone(), updatedBooking.getStartTime(),
                updatedBooking.getEndTime(), updatedBooking.getBookingStatus(), updatedBooking.getNotes(),
                updatedBooking.getCreatedAt(), payload.serviceId(), currentUser.getUserId());
    }

    @Transactional
    public BookingResponseDTO updateBookingStatus(UUID bookingId, BookingStatus newStatus) {
        Booking found = findBookingById(bookingId);

        if (found.getBookingStatus().equals(BookingStatus.CANCELLED) || found.getBookingStatus().equals(BookingStatus.COMPLETED)) {
            throw new BadRequestException("Non puoi aggiornare lo stato di una prenotazione " + found.getBookingStatus());
        }

        found.setBookingStatus(newStatus);
        Booking updatedBooking = bookingRepository.save(found);

        log.info("Stato prenotazione {} aggiornato a {}", updatedBooking.getBookingId(), updatedBooking.getBookingStatus());

        return new BookingResponseDTO(
                updatedBooking.getBookingId(),
                updatedBooking.getCustomerName(),
                updatedBooking.getCustomerEmail(),
                updatedBooking.getCustomerPhone(),
                updatedBooking.getStartTime(),
                updatedBooking.getEndTime(),
                updatedBooking.getBookingStatus(),
                updatedBooking.getNotes(),
                updatedBooking.getCreatedAt(),
                updatedBooking.getService() != null ? updatedBooking.getService().getServiceId() : null,
                updatedBooking.getUser() != null ? updatedBooking.getUser().getUserId() : null
        );
    }


    @Transactional
    public void findBookingByIdAndDelete(UUID idBooking, User currentUser) {
        Booking found = findBookingById(idBooking);


        if (currentUser.getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ROLE_ADMIN"))) {
            bookingRepository.delete(found);
            return;
        }

        if (found.getUser() == null || !found.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new UnauthorizedException("Non puoi cancellare una prenotazione non tua.");
        }

        if (found.getStartTime().isBefore(LocalDateTime.now().plusHours(24))) {
            throw new BadRequestException("Puoi cancellare la prenotazione solo fino a 24 ore prima");
        }

        this.bookingRepository.delete(found);
        log.info("La prenotazione {} è stata eliminata!", found.getBookingId());
    }

}
