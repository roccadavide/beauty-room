-- V79: persist the "remember me" intent on each refresh token so the choice survives rotation
-- (every /auth/refresh re-issues the cookie). DEFAULT true so users already logged in keep their
-- persistent 14-day cookie through their next rotation -- no forced logout on deploy.

ALTER TABLE refresh_tokens
    ADD COLUMN remember_me boolean NOT NULL DEFAULT true;
