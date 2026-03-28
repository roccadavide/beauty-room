ALTER TABLE results ADD COLUMN IF NOT EXISTS service_id UUID;

ALTER TABLE results ADD CONSTRAINT fk_result_service
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE SET NULL;
