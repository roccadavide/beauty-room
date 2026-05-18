-- Removes booking_services rows that duplicate the package service for bookings
-- linked to an implicit ClientPackageAssignment. Run-once data fix to clean up
-- records created before the CASE A/B branch was patched to DELETE these rows
-- at booking creation time.

DELETE FROM booking_services bs
WHERE EXISTS (
    SELECT 1
    FROM booking_package_link bpl
    JOIN client_package_assignments cpa ON cpa.id = bpl.client_package_assignment_id
    JOIN services s ON s.service_id = bs.service_id
    WHERE bpl.booking_id = bs.booking_id
      AND (
          LOWER(TRIM(cpa.custom_package_name)) = LOWER(TRIM(s.title))
          OR EXISTS (
              SELECT 1 FROM service_options so
              WHERE so.option_id = cpa.service_option_id
                AND so.service_id = bs.service_id
          )
      )
);
