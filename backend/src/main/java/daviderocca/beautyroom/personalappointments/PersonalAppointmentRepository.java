package daviderocca.beautyroom.personalappointments;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface PersonalAppointmentRepository extends JpaRepository<PersonalAppointment, UUID> {

    List<PersonalAppointment> findByAppointmentDateOrderByStartTime(LocalDate date);

    List<PersonalAppointment> findByAppointmentDateBetweenOrderByAppointmentDateAscStartTimeAsc(
            LocalDate start, LocalDate end);
}
