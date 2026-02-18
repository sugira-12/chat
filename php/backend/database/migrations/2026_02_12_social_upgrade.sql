-- Upgrade for profile cover photo, message requests, story replies, ads, and admin alerts.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cover_photo_url VARCHAR(255) NULL AFTER avatar_url;

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS caption TEXT NULL AFTER media_url;

CREATE TABLE IF NOT EXISTS story_replies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  story_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_story_replies_story (story_id),
  KEY idx_story_replies_user (user_id),
  CONSTRAINT fk_story_replies_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  CONSTRAINT fk_story_replies_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS message_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  requester_id BIGINT UNSIGNED NOT NULL,
  recipient_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','accepted','denied') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_message_requests_conversation (conversation_id),
  UNIQUE KEY uniq_message_requests_pair (requester_id, recipient_id),
  KEY idx_message_requests_recipient_status (recipient_id, status),
  CONSTRAINT fk_message_requests_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_requests_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_requests_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(120) NOT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_system_events_actor (actor_id),
  KEY idx_system_events_created (created_at),
  CONSTRAINT fk_system_events_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NULL,
  data JSON NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_alerts_admin_read_created (admin_user_id, is_read, created_at),
  CONSTRAINT fk_admin_alerts_admin FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_by BIGINT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  body TEXT NULL,
  image_url VARCHAR(255) NULL,
  link_url VARCHAR(255) NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ads_active_window (is_active, starts_at, ends_at),
  CONSTRAINT fk_ads_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_by BIGINT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  body TEXT NULL,
  image_url VARCHAR(255) NULL,
  link_url VARCHAR(255) NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ads_active_window (is_active, starts_at, ends_at),
  CONSTRAINT fk_ads_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
