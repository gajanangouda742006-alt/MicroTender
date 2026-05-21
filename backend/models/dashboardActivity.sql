CREATE TABLE IF NOT EXISTS dashboard_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('complaint','vendor','bid','fraud','tender') NOT NULL,
  payload JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
