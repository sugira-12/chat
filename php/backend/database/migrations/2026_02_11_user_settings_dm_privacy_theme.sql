-- Add DM privacy and theme mode settings.
-- Run this on existing installs that were created before these columns existed.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS dm_privacy ENUM('everyone','friends','nobody') NOT NULL DEFAULT 'everyone' AFTER show_online,
  ADD COLUMN IF NOT EXISTS theme_mode ENUM('light','dark','sunset','midnight') NOT NULL DEFAULT 'light' AFTER dm_privacy;

UPDATE user_settings
SET dm_privacy = CASE
  WHEN allow_message_requests = 1 THEN 'everyone'
  ELSE 'friends'
END
WHERE dm_privacy IS NULL OR dm_privacy = '';

UPDATE user_settings
SET theme_mode = CASE
  WHEN dark_mode = 1 THEN 'dark'
  ELSE 'light'
END
WHERE theme_mode IS NULL OR theme_mode = '';
