<?php
// Database connection configuration
// For hosting, either edit these defaults, set environment variables,
// or create db.config.php with DB_HOST, DB_NAME, DB_USER, DB_PASS constants.
$localConfig = __DIR__ . '/db.config.php';
if (file_exists($localConfig)) {
    require_once $localConfig;
}

if (!defined('DB_HOST')) define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
if (!defined('DB_NAME')) define('DB_NAME', getenv('DB_NAME') ?: 'attendflow_db');
if (!defined('DB_USER')) define('DB_USER', getenv('DB_USER') ?: 'root');
if (!defined('DB_PASS')) define('DB_PASS', getenv('DB_PASS') ?: '');

$pdoOptions = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    try {
        // Preferred path for Hostinger/shared hosting: database already exists.
        $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, $pdoOptions);
    } catch (PDOException $firstError) {
        // Local/dev fallback: create the database only when the DB user is allowed to do so.
        $pdo = new PDO("mysql:host=" . DB_HOST . ";charset=utf8mb4", DB_USER, DB_PASS, $pdoOptions);
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `" . DB_NAME . "`");
    }

    // Auto-run schema migrations to make deployment seamless on Hostinger/Local
    run_migrations($pdo);

} catch (PDOException $e) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed: ' . $e->getMessage()
    ]);
    exit;
}

// Seamless Database Migration helper to alter/add columns on the fly
function run_migrations($db) {
    // 1. Create admins table
    $db->exec("CREATE TABLE IF NOT EXISTS `admins` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `username` VARCHAR(50) UNIQUE NOT NULL,
        `password` VARCHAR(255) NOT NULL,
        `role` VARCHAR(50) NOT NULL,
        `name` VARCHAR(150) NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Seed default admin accounts if table is empty
    $countAdmins = $db->query("SELECT COUNT(*) FROM `admins`")->fetchColumn();
    if ($countAdmins == 0) {
        $stmt = $db->prepare("INSERT INTO `admins` (username, password, role, name) VALUES (?, ?, ?, ?)");
        // Seeding standard default accounts
        // admin123
        $stmt->execute(['admin', password_hash('admin123', PASSWORD_BCRYPT), 'Super Admin', 'Super Admin (System)']);
        // hr123
        $stmt->execute(['hr', password_hash('hr123', PASSWORD_BCRYPT), 'HR Manager', 'HR Representative']);
        // super123
        $stmt->execute(['supervisor', password_hash('super123', PASSWORD_BCRYPT), 'Supervisor', 'Floor Supervisor']);
    }

    // 2. Create admin_settings table if not exists and seed 1
    $db->exec("CREATE TABLE IF NOT EXISTS `admin_settings` (
        `id` INT PRIMARY KEY DEFAULT 1,
        `password` VARCHAR(255) DEFAULT '',
        `login_enabled` TINYINT(1) DEFAULT 0,
        `company_name` VARCHAR(255) DEFAULT 'ABIRAMI INDUSTRIES',
        `company_address` TEXT DEFAULT NULL,
        `company_phone` VARCHAR(50) DEFAULT '+91 98765 43210',
        `company_logo` LONGTEXT DEFAULT NULL,
        `theme` VARCHAR(20) DEFAULT 'light',
        `color_theme` VARCHAR(20) DEFAULT 'indigo',
        `day_range` INT DEFAULT 6
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $countSettings = $db->query("SELECT COUNT(*) FROM `admin_settings` WHERE id = 1")->fetchColumn();
    if ($countSettings == 0) {
        $db->exec("INSERT INTO `admin_settings` (id, password, login_enabled, company_name, company_address, company_phone, company_logo, theme, color_theme, day_range) 
                   VALUES (1, '', 0, 'ABIRAMI INDUSTRIES', 'Tamil Nadu, India', '+91 98765 43210', '', 'light', 'indigo', 6)");
    }

    // 3. Create employees table
    $db->exec("CREATE TABLE IF NOT EXISTS `employees` (
        `id` VARCHAR(50) PRIMARY KEY,
        `name` VARCHAR(150) NOT NULL,
        `mobile` VARCHAR(50) DEFAULT NULL,
        `joining_date` DATE DEFAULT NULL,
        `department` VARCHAR(100) DEFAULT 'Production',
        `designation` VARCHAR(150) DEFAULT NULL,
        `address` TEXT DEFAULT NULL,
        `notes` TEXT DEFAULT NULL,
        `photo` LONGTEXT DEFAULT NULL,
        `status` VARCHAR(20) DEFAULT 'Active',
        `rate_present` DECIMAL(10,2) DEFAULT 250.00,
        `rate_ot` DECIMAL(10,2) DEFAULT 350.00,
        `rate_absent` DECIMAL(10,2) DEFAULT 0.00,
        `rate_off` DECIMAL(10,2) DEFAULT 150.00,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 4. Alter employees table with advanced columns if missing
    $employeeColumns = [
        'category' => "VARCHAR(50) DEFAULT 'Permanent'",
        'default_shift' => "VARCHAR(50) DEFAULT 'General'",
        'aadhaar_proof' => "LONGTEXT DEFAULT NULL",
        'id_proof' => "LONGTEXT DEFAULT NULL",
        'bank_name' => "VARCHAR(150) DEFAULT NULL",
        'bank_acc' => "VARCHAR(100) DEFAULT NULL",
        'bank_ifsc' => "VARCHAR(50) DEFAULT NULL",
        'bank_branch' => "VARCHAR(150) DEFAULT NULL",
        'emergency_name' => "VARCHAR(150) DEFAULT NULL",
        'emergency_relation' => "VARCHAR(50) DEFAULT NULL",
        'emergency_phone' => "VARCHAR(50) DEFAULT NULL",
        'remarks' => "TEXT DEFAULT NULL"
    ];
    ensure_columns_exist($db, 'employees', $employeeColumns);

    // 5. Create attendance table
    $db->exec("CREATE TABLE IF NOT EXISTS `attendance` (
        `date` DATE NOT NULL,
        `employee_id` VARCHAR(50) NOT NULL,
        `status` VARCHAR(50) NOT NULL,
        `check_in` VARCHAR(10) DEFAULT '',
        `check_out` VARCHAR(10) DEFAULT '',
        `ot_hours` DECIMAL(5,2) DEFAULT 0.00,
        `late` TINYINT(1) DEFAULT 0,
        `remarks` TEXT DEFAULT NULL,
        PRIMARY KEY (`date`, `employee_id`),
        FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 6. Alter attendance table with advanced columns
    $attendanceColumns = [
        'shift' => "VARCHAR(50) DEFAULT 'General'",
        'is_locked' => "TINYINT(1) DEFAULT 0",
        'is_approved' => "TINYINT(1) DEFAULT 1",
        'late_minutes' => "INT DEFAULT 0"
    ];
    ensure_columns_exist($db, 'attendance', $attendanceColumns);

    // 7. Create payroll_history table
    $db->exec("CREATE TABLE IF NOT EXISTS `payroll_history` (
        `tx_id` VARCHAR(100) PRIMARY KEY,
        `employee_id` VARCHAR(50) NOT NULL,
        `employee_name` VARCHAR(150) NOT NULL,
        `week_month_id` VARCHAR(50) NOT NULL,
        `period_type` VARCHAR(20) DEFAULT 'weekly',
        `base_pay` DECIMAL(10,2) DEFAULT 0.00,
        `incentives` DECIMAL(10,2) DEFAULT 0.00,
        `deductions` DECIMAL(10,2) DEFAULT 0.00,
        `net_payout` DECIMAL(10,2) DEFAULT 0.00,
        `process_date` DATE NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 8. Alter payroll_history table with advanced columns
    $payrollColumns = [
        'bonus' => "DECIMAL(10,2) DEFAULT 0.00",
        'incentive' => "DECIMAL(10,2) DEFAULT 0.00",
        'deduct_advance' => "DECIMAL(10,2) DEFAULT 0.00",
        'deduct_loan' => "DECIMAL(10,2) DEFAULT 0.00",
        'deduct_fine' => "DECIMAL(10,2) DEFAULT 0.00",
        'approval_status' => "VARCHAR(50) DEFAULT 'Approved'",
        'approved_by' => "VARCHAR(150) DEFAULT NULL"
    ];
    ensure_columns_exist($db, 'payroll_history', $payrollColumns);

    // 9. Create other tables if not exists
    $db->exec("CREATE TABLE IF NOT EXISTS `holidays` (
        `date` DATE PRIMARY KEY,
        `occasion` VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS `announcements` (
        `id` BIGINT PRIMARY KEY,
        `date` VARCHAR(100) NOT NULL,
        `title` VARCHAR(255) NOT NULL,
        `content` TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS `audit_logs` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `timestamp` VARCHAR(100) NOT NULL,
        `action` VARCHAR(255) NOT NULL,
        `details` TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Alter audit logs to add username if missing
    ensure_columns_exist($db, 'audit_logs', [
        'username' => "VARCHAR(50) DEFAULT 'system'"
    ]);
}

function ensure_columns_exist($db, $table, $columns) {
    foreach ($columns as $col => $definition) {
        $stmt = $db->query("SHOW COLUMNS FROM `$table` LIKE '$col'");
        if (!$stmt->fetch()) {
            $db->exec("ALTER TABLE `$table` ADD `$col` $definition");
        }
    }
}
