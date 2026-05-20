-- Bootstrap SQL Script for AttendFlow Advanced Dashboard for ABIRAMI INDUSTRIES
-- You can import this script directly into phpMyAdmin on Hostinger.

CREATE DATABASE IF NOT EXISTS `attendflow_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `attendflow_db`;

-- 1. Admin & System Settings Table
CREATE TABLE IF NOT EXISTS `admin_settings` (
    `id` INT PRIMARY KEY DEFAULT 1,
    `password` VARCHAR(255) DEFAULT '',
    `login_enabled` TINYINT(1) DEFAULT 0,
    `company_name` VARCHAR(255) DEFAULT 'ABIRAMI INDUSTRIES',
    `company_address` TEXT DEFAULT NULL,
    `company_phone` VARCHAR(50) DEFAULT '+91 98765 43210',
    `company_logo` LONGTEXT DEFAULT NULL, -- Base64 String representation
    `theme` VARCHAR(20) DEFAULT 'light',
    `color_theme` VARCHAR(20) DEFAULT 'indigo',
    `day_range` INT DEFAULT 6
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Populate default settings if not exists
INSERT INTO `admin_settings` (`id`, `password`, `login_enabled`, `company_name`, `company_address`, `company_phone`, `company_logo`, `theme`, `color_theme`, `day_range`)
SELECT 1, '', 0, 'ABIRAMI INDUSTRIES', 'Tamil Nadu, India', '+91 98765 43210', '', 'light', 'indigo', 6
WHERE NOT EXISTS (SELECT * FROM `admin_settings` WHERE `id` = 1);

-- 2. Admins Table (For Multi-Admin Role-Based Access Control)
CREATE TABLE IF NOT EXISTS `admins` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) UNIQUE NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` VARCHAR(50) NOT NULL, -- 'Super Admin', 'HR Manager', 'Supervisor'
    `name` VARCHAR(150) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- We populate the default admin accounts dynamically in PHP to hash the passwords securely.

-- 3. Employees Roster Table
CREATE TABLE IF NOT EXISTS `employees` (
    `id` VARCHAR(50) PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `mobile` VARCHAR(50) DEFAULT NULL,
    `joining_date` DATE DEFAULT NULL,
    `department` VARCHAR(100) DEFAULT 'Production',
    `designation` VARCHAR(150) DEFAULT NULL,
    `address` TEXT DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `photo` LONGTEXT DEFAULT NULL, -- Base64 String photo
    `status` VARCHAR(20) DEFAULT 'Active', -- 'Active' or 'Archived'
    `rate_present` DECIMAL(10,2) DEFAULT 250.00,
    `rate_ot` DECIMAL(10,2) DEFAULT 350.00,
    `rate_absent` DECIMAL(10,2) DEFAULT 0.00,
    `rate_off` DECIMAL(10,2) DEFAULT 150.00,
    -- Advanced Fields
    `category` VARCHAR(50) DEFAULT 'Permanent', -- 'Permanent', 'Temporary', 'Contract'
    `default_shift` VARCHAR(50) DEFAULT 'General',
    `aadhaar_proof` LONGTEXT DEFAULT NULL, -- Base64 String of Aadhaar ID Card
    `id_proof` LONGTEXT DEFAULT NULL, -- Base64 String of alternative ID Proof
    `bank_name` VARCHAR(150) DEFAULT NULL,
    `bank_acc` VARCHAR(100) DEFAULT NULL,
    `bank_ifsc` VARCHAR(50) DEFAULT NULL,
    `bank_branch` VARCHAR(150) DEFAULT NULL,
    `emergency_name` VARCHAR(150) DEFAULT NULL,
    `emergency_relation` VARCHAR(50) DEFAULT NULL,
    `emergency_phone` VARCHAR(50) DEFAULT NULL,
    `remarks` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Attendance Logs Table
CREATE TABLE IF NOT EXISTS `attendance` (
    `date` DATE NOT NULL,
    `employee_id` VARCHAR(50) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `check_in` VARCHAR(10) DEFAULT '',
    `check_out` VARCHAR(10) DEFAULT '',
    `ot_hours` DECIMAL(5,2) DEFAULT 0.00,
    `late` TINYINT(1) DEFAULT 0,
    `remarks` TEXT DEFAULT NULL,
    -- Advanced Fields
    `shift` VARCHAR(50) DEFAULT 'General', -- 'Shift A', 'Shift B', 'Shift C', 'Night', 'General'
    `is_locked` TINYINT(1) DEFAULT 0, -- Locked after final submit
    `is_approved` TINYINT(1) DEFAULT 1, -- Approval system for supervisor/HR edits
    `late_minutes` INT DEFAULT 0, -- Minutes late
    PRIMARY KEY (`date`, `employee_id`),
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Payroll Approved History Ledger
CREATE TABLE IF NOT EXISTS `payroll_history` (
    `tx_id` VARCHAR(100) PRIMARY KEY,
    `employee_id` VARCHAR(50) NOT NULL,
    `employee_name` VARCHAR(150) NOT NULL,
    `week_month_id` VARCHAR(50) NOT NULL, -- e.g. '2026-W21' or '2026-05'
    `period_type` VARCHAR(20) DEFAULT 'weekly', -- 'weekly' or 'monthly'
    `base_pay` DECIMAL(10,2) DEFAULT 0.00,
    `incentives` DECIMAL(10,2) DEFAULT 0.00,
    `deductions` DECIMAL(10,2) DEFAULT 0.00,
    `net_payout` DECIMAL(10,2) DEFAULT 0.00,
    -- Advanced Breakdown Fields
    `bonus` DECIMAL(10,2) DEFAULT 0.00,
    `incentive` DECIMAL(10,2) DEFAULT 0.00,
    `deduct_advance` DECIMAL(10,2) DEFAULT 0.00,
    `deduct_loan` DECIMAL(10,2) DEFAULT 0.00,
    `deduct_fine` DECIMAL(10,2) DEFAULT 0.00,
    `approval_status` VARCHAR(50) DEFAULT 'Approved', -- 'Pending Approval', 'Approved'
    `approved_by` VARCHAR(150) DEFAULT NULL,
    `process_date` DATE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Company Holidays Table
CREATE TABLE IF NOT EXISTS `holidays` (
    `date` DATE PRIMARY KEY,
    `occasion` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Noticeboard Announcements Table
CREATE TABLE IF NOT EXISTS `announcements` (
    `id` BIGINT PRIMARY KEY,
    `date` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Audit Activity Logs Table
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `timestamp` VARCHAR(100) NOT NULL,
    `action` VARCHAR(255) NOT NULL,
    `details` TEXT NOT NULL,
    `username` VARCHAR(50) DEFAULT 'system'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
