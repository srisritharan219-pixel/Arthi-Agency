<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");
session_start();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'db.php';

// Helper to read JSON request body
function getPostData() {
    $input = file_get_contents("php://input");
    return json_decode($input, true) ?: $_POST;
}

$action = $_GET['action'] ?? '';

function isLoginProtectionEnabled($pdo) {
    try {
        $stmt = $pdo->query("SELECT login_enabled FROM admin_settings WHERE id = 1");
        $row = $stmt->fetch();
        return $row && (int)$row['login_enabled'] === 1;
    } catch (Exception $e) {
        return false;
    }
}

function requireAuthenticatedAdmin($pdo, $action) {
    $publicActions = ['load_state', 'login', 'logout'];
    if (in_array($action, $publicActions, true)) {
        return;
    }

    if (isLoginProtectionEnabled($pdo) && empty($_SESSION['attendflow_user'])) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Admin login required']);
        exit;
    }
}

requireAuthenticatedAdmin($pdo, $action);

switch ($action) {
    case 'load_state':
        try {
            // 1. Admin & System Settings
            $stmt = $pdo->query("SELECT * FROM admin_settings WHERE id = 1");
            $settingsRow = $stmt->fetch();
            $admin = [
                'password' => $settingsRow['password'] ?? '',
                'loginEnabled' => ($settingsRow['login_enabled'] ?? 0) == 1,
                'companyName' => $settingsRow['company_name'] ?? 'ABIRAMI INDUSTRIES',
                'companyAddress' => $settingsRow['company_address'] ?? 'Tamil Nadu, India',
                'companyPhone' => $settingsRow['company_phone'] ?? '+91 98765 43210',
                'companyLogo' => $settingsRow['company_logo'] ?? '',
                'theme' => $settingsRow['theme'] ?? 'light',
                'colorTheme' => $settingsRow['color_theme'] ?? 'indigo',
                'dayRange' => (int)($settingsRow['day_range'] ?? 6)
            ];

            if ($admin['loginEnabled'] && empty($_SESSION['attendflow_user'])) {
                echo json_encode([
                    'status' => 'success',
                    'requiresLogin' => true,
                    'data' => [
                        'admin' => $admin,
                        'adminUsers' => [],
                        'employees' => [],
                        'attendance' => [],
                        'payrollLedger' => [],
                        'holidays' => [],
                        'announcements' => [],
                        'auditLogs' => []
                    ]
                ]);
                break;
            }

            // 2. Admins Users (without passwords)
            $stmt = $pdo->query("SELECT id, username, role, name, created_at FROM admins ORDER BY username ASC");
            $adminUsers = $stmt->fetchAll() ?: [];

            // 3. Employees
            $stmt = $pdo->query("SELECT * FROM employees ORDER BY name ASC");
            $employees = [];
            while ($row = $stmt->fetch()) {
                $employees[] = [
                    'id' => $row['id'],
                    'name' => $row['name'],
                    'mobile' => $row['mobile'] ?? '',
                    'joiningDate' => $row['joining_date'] ?? '',
                    'department' => $row['department'] ?? 'Production',
                    'designation' => $row['designation'] ?? '',
                    'address' => $row['address'] ?? '',
                    'notes' => $row['notes'] ?? '',
                    'photo' => $row['photo'] ?? '',
                    'status' => $row['status'] ?? 'Active',
                    'rates' => [
                        'present' => (float)$row['rate_present'],
                        'present_ot' => (float)$row['rate_ot'],
                        'absent' => (float)$row['rate_absent'],
                        'off_day' => (float)$row['rate_off']
                    ],
                    'category' => $row['category'] ?? 'Permanent',
                    'defaultShift' => $row['default_shift'] ?? 'General',
                    'aadhaarProof' => $row['aadhaar_proof'] ?? '',
                    'idProof' => $row['id_proof'] ?? '',
                    'bankName' => $row['bank_name'] ?? '',
                    'bankAcc' => $row['bank_acc'] ?? '',
                    'bankIfsc' => $row['bank_ifsc'] ?? '',
                    'bankBranch' => $row['bank_branch'] ?? '',
                    'emergencyName' => $row['emergency_name'] ?? '',
                    'emergencyRelation' => $row['emergency_relation'] ?? '',
                    'emergencyPhone' => $row['emergency_phone'] ?? '',
                    'remarks' => $row['remarks'] ?? ''
                ];
            }

            // 4. Attendance Date-Keyed Mapping
            $stmt = $pdo->query("SELECT * FROM attendance");
            $attendance = [];
            while ($row = $stmt->fetch()) {
                $dateKey = $row['date'];
                if (!isset($attendance[$dateKey])) {
                    $attendance[$dateKey] = [];
                }
                $attendance[$dateKey][$row['employee_id']] = [
                    'status' => $row['status'],
                    'checkIn' => $row['check_in'] ?? '',
                    'checkOut' => $row['check_out'] ?? '',
                    'otHours' => (float)($row['ot_hours'] ?? 0),
                    'late' => ($row['late'] ?? 0) == 1,
                    'remarks' => $row['remarks'] ?? '',
                    'shift' => $row['shift'] ?? 'General',
                    'isLocked' => ($row['is_locked'] ?? 0) == 1,
                    'isApproved' => ($row['is_approved'] ?? 1) == 1,
                    'lateMinutes' => (int)($row['late_minutes'] ?? 0)
                ];
            }

            // 5. Payroll Ledger Map
            $stmt = $pdo->query("SELECT * FROM payroll_history ORDER BY created_at DESC");
            $payrollLedger = [];
            while ($row = $stmt->fetch()) {
                $period = $row['week_month_id'];
                if (!isset($payrollLedger[$period])) {
                    $payrollLedger[$period] = [];
                }
                $payrollLedger[$period][$row['employee_id']] = [
                    'txId' => $row['tx_id'],
                    'empId' => $row['employee_id'],
                    'empName' => $row['employee_name'],
                    'week' => $row['week_month_id'],
                    'periodType' => $row['period_type'] ?? 'weekly',
                    'basePay' => (float)$row['base_pay'],
                    'incentives' => (float)$row['incentives'],
                    'deductions' => (float)$row['deductions'],
                    'netSalary' => (float)$row['net_payout'],
                    'bonus' => (float)($row['bonus'] ?? 0),
                    'incentive' => (float)($row['incentive'] ?? 0),
                    'deductAdvance' => (float)($row['deduct_advance'] ?? 0),
                    'deductLoan' => (float)($row['deduct_loan'] ?? 0),
                    'deductFine' => (float)($row['deduct_fine'] ?? 0),
                    'approvalStatus' => $row['approval_status'] ?? 'Approved',
                    'approvedBy' => $row['approved_by'] ?? '',
                    'payDate' => $row['process_date']
                ];
            }

            // 6. Holidays Map
            $stmt = $pdo->query("SELECT * FROM holidays");
            $holidays = [];
            while ($row = $stmt->fetch()) {
                $holidays[$row['date']] = $row['occasion'];
            }

            // 7. Announcements Array
            $stmt = $pdo->query("SELECT * FROM announcements ORDER BY id DESC");
            $announcements = $stmt->fetchAll() ?: [];

            // 8. Audit Activity Logs
            $stmt = $pdo->query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100");
            $auditLogs = $stmt->fetchAll() ?: [];

            echo json_encode([
                'status' => 'success',
                'data' => [
                    'admin' => $admin,
                    'adminUsers' => $adminUsers,
                    'employees' => $employees,
                    'attendance' => $attendance,
                    'payrollLedger' => $payrollLedger,
                    'holidays' => $holidays,
                    'announcements' => $announcements,
                    'auditLogs' => $auditLogs
                ]
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'login':
        $data = getPostData();
        $username = trim($data['username'] ?? '');
        $password = trim($data['password'] ?? '');

        if (!$username || !$password) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Username and Password required']);
            break;
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM admins WHERE username = ?");
            $stmt->execute([$username]);
            $userRow = $stmt->fetch();

            if ($userRow && password_verify($password, $userRow['password'])) {
                $_SESSION['attendflow_user'] = [
                    'username' => $userRow['username'],
                    'role' => $userRow['role'],
                    'name' => $userRow['name']
                ];
                echo json_encode([
                    'status' => 'success',
                    'data' => $_SESSION['attendflow_user']
                ]);
            } else {
                http_response_code(401);
                echo json_encode(['status' => 'error', 'message' => 'Invalid username or password!']);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'logout':
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params["path"], $params["domain"], $params["secure"], $params["httponly"]);
        }
        session_destroy();
        echo json_encode(['status' => 'success']);
        break;

    case 'save_admin':
        $data = getPostData();
        $username = trim($data['username'] ?? '');
        $name = trim($data['name'] ?? '');
        $role = trim($data['role'] ?? '');
        $password = trim($data['password'] ?? '');

        if (!$username || !$name || !$role) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Missing username, name, or role']);
            break;
        }

        try {
            if ($password) {
                // Insert or update with password
                $hashedPass = password_hash($password, PASSWORD_BCRYPT);
                $stmt = $pdo->prepare("
                    INSERT INTO admins (username, password, role, name)
                    VALUES (:username, :password, :role, :name)
                    ON DUPLICATE KEY UPDATE
                        password = :password,
                        role = :role,
                        name = :name
                ");
                $stmt->execute([
                    ':username' => $username,
                    ':password' => $hashedPass,
                    ':role' => $role,
                    ':name' => $name
                ]);
            } else {
                // Update without changing password
                $stmt = $pdo->prepare("
                    UPDATE admins
                    SET role = :role, name = :name
                    WHERE username = :username
                ");
                $stmt->execute([
                    ':username' => $username,
                    ':role' => $role,
                    ':name' => $name
                ]);
            }
            echo json_encode(['status' => 'success']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'delete_admin':
        $data = getPostData();
        $username = trim($data['username'] ?? '');

        if ($username === 'admin') {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Cannot delete system super admin account!']);
            break;
        }

        try {
            $stmt = $pdo->prepare("DELETE FROM admins WHERE username = ?");
            $stmt->execute([$username]);
            echo json_encode(['status' => 'success']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'save_employee':
        $data = getPostData();
        if (empty($data['id']) || empty($data['name'])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Missing ID or Name']);
            break;
        }

        try {
            $stmt = $pdo->prepare("
                INSERT INTO employees (
                    id, name, mobile, joining_date, department, designation, address, notes, photo, status, 
                    rate_present, rate_ot, rate_absent, rate_off,
                    category, default_shift, aadhaar_proof, id_proof, bank_name, bank_acc, bank_ifsc, bank_branch,
                    emergency_name, emergency_relation, emergency_phone, remarks
                )
                VALUES (
                    :id, :name, :mobile, :joining_date, :department, :designation, :address, :notes, :photo, :status, 
                    :rate_present, :rate_ot, :rate_absent, :rate_off,
                    :category, :default_shift, :aadhaar_proof, :id_proof, :bank_name, :bank_acc, :bank_ifsc, :bank_branch,
                    :emergency_name, :emergency_relation, :emergency_phone, :remarks
                )
                ON DUPLICATE KEY UPDATE
                    name = :name,
                    mobile = :mobile,
                    joining_date = :joining_date,
                    department = :department,
                    designation = :designation,
                    address = :address,
                    notes = :notes,
                    photo = :photo,
                    status = :status,
                    rate_present = :rate_present,
                    rate_ot = :rate_ot,
                    rate_absent = :rate_absent,
                    rate_off = :rate_off,
                    category = :category,
                    default_shift = :default_shift,
                    aadhaar_proof = :aadhaar_proof,
                    id_proof = :id_proof,
                    bank_name = :bank_name,
                    bank_acc = :bank_acc,
                    bank_ifsc = :bank_ifsc,
                    bank_branch = :bank_branch,
                    emergency_name = :emergency_name,
                    emergency_relation = :emergency_relation,
                    emergency_phone = :emergency_phone,
                    remarks = :remarks
            ");
            $stmt->execute([
                ':id' => $data['id'],
                ':name' => $data['name'],
                ':mobile' => $data['mobile'] ?? null,
                ':joining_date' => $data['joiningDate'] ?? null,
                ':department' => $data['department'] ?? 'Production',
                ':designation' => $data['designation'] ?? null,
                ':address' => $data['address'] ?? null,
                ':notes' => $data['notes'] ?? null,
                ':photo' => $data['photo'] ?? null,
                ':status' => $data['status'] ?? 'Active',
                ':rate_present' => $data['rates']['present'] ?? 250,
                ':rate_ot' => $data['rates']['present_ot'] ?? 350,
                ':rate_absent' => $data['rates']['absent'] ?? 0,
                ':rate_off' => $data['rates']['off_day'] ?? 150,
                ':category' => $data['category'] ?? 'Permanent',
                ':default_shift' => $data['defaultShift'] ?? 'General',
                ':aadhaar_proof' => $data['aadhaarProof'] ?? null,
                ':id_proof' => $data['idProof'] ?? null,
                ':bank_name' => $data['bankName'] ?? null,
                ':bank_acc' => $data['bankAcc'] ?? null,
                ':bank_ifsc' => $data['bankIfsc'] ?? null,
                ':bank_branch' => $data['bankBranch'] ?? null,
                ':emergency_name' => $data['emergencyName'] ?? null,
                ':emergency_relation' => $data['emergencyRelation'] ?? null,
                ':emergency_phone' => $data['emergencyPhone'] ?? null,
                ':remarks' => $data['remarks'] ?? null
            ]);
            echo json_encode(['status' => 'success']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'delete_employee':
        $data = getPostData();
        $id = $data['id'] ?? '';
        $mode = $data['mode'] ?? ''; // 'archive', 'restore', or 'delete'

        if (!$id) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Missing worker ID']);
            break;
        }

        try {
            if ($mode === 'delete') {
                $stmt = $pdo->prepare("DELETE FROM employees WHERE id = ?");
                $stmt->execute([$id]);
            } else {
                $status = ($mode === 'archive') ? 'Archived' : 'Active';
                $stmt = $pdo->prepare("UPDATE employees SET status = ? WHERE id = ?");
                $stmt->execute([$status, $id]);
            }
            echo json_encode(['status' => 'success']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'save_attendance':
        $data = getPostData(); // Expected array of entries: [{date, empId, status, checkIn, checkOut, otHours, late, remarks, shift, isLocked, isApproved, lateMinutes}]
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Data must be an array of attendance records']);
            break;
        }

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("
                INSERT INTO attendance (date, employee_id, status, check_in, check_out, ot_hours, late, remarks, shift, is_locked, is_approved, late_minutes)
                VALUES (:date, :emp_id, :status, :check_in, :check_out, :ot_hours, :late, :remarks, :shift, :is_locked, :is_approved, :late_minutes)
                ON DUPLICATE KEY UPDATE
                    status = :status,
                    check_in = :check_in,
                    check_out = :check_out,
                    ot_hours = :ot_hours,
                    late = :late,
                    remarks = :remarks,
                    shift = :shift,
                    is_locked = :is_locked,
                    is_approved = :is_approved,
                    late_minutes = :late_minutes
            ");
            foreach ($data as $row) {
                $stmt->execute([
                    ':date' => $row['date'],
                    ':emp_id' => $row['empId'],
                    ':status' => $row['status'],
                    ':check_in' => $row['checkIn'] ?? '',
                    ':check_out' => $row['checkOut'] ?? '',
                    ':ot_hours' => $row['otHours'] ?? 0.0,
                    ':late' => !empty($row['late']) ? 1 : 0,
                    ':remarks' => $row['remarks'] ?? null,
                    ':shift' => $row['shift'] ?? 'General',
                    ':is_locked' => !empty($row['isLocked']) ? 1 : 0,
                    ':is_approved' => isset($row['isApproved']) ? (!empty($row['isApproved']) ? 1 : 0) : 1,
                    ':late_minutes' => (int)($row['lateMinutes'] ?? 0)
                ]);
            }
            $pdo->commit();
            echo json_encode(['status' => 'success']);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'save_payroll':
        $data = getPostData();
        if (empty($data['txId'])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Missing transaction ID']);
            break;
        }

        try {
            $stmt = $pdo->prepare("
                INSERT INTO payroll_history (
                    tx_id, employee_id, employee_name, week_month_id, period_type, 
                    base_pay, incentives, deductions, net_payout,
                    bonus, incentive, deduct_advance, deduct_loan, deduct_fine, approval_status, approved_by, process_date
                )
                VALUES (
                    :tx_id, :employee_id, :employee_name, :week_month_id, :period_type, 
                    :base_pay, :incentives, :deductions, :net_payout,
                    :bonus, :incentive, :deduct_advance, :deduct_loan, :deduct_fine, :approval_status, :approved_by, :process_date
                )
                ON DUPLICATE KEY UPDATE
                    base_pay = :base_pay,
                    incentives = :incentives,
                    deductions = :deductions,
                    net_payout = :net_payout,
                    bonus = :bonus,
                    incentive = :incentive,
                    deduct_advance = :deduct_advance,
                    deduct_loan = :deduct_loan,
                    deduct_fine = :deduct_fine,
                    approval_status = :approval_status,
                    approved_by = :approved_by,
                    process_date = :process_date
            ");
            $stmt->execute([
                ':tx_id' => $data['txId'],
                ':employee_id' => $data['empId'],
                ':employee_name' => $data['empName'],
                ':week_month_id' => $data['week'],
                ':period_type' => $data['periodType'] ?? 'weekly',
                ':base_pay' => $data['basePay'] ?? 0,
                ':incentives' => $data['incentives'] ?? 0,
                ':deductions' => $data['deductions'] ?? 0,
                ':net_payout' => $data['netSalary'] ?? 0,
                ':bonus' => $data['bonus'] ?? 0,
                ':incentive' => $data['incentive'] ?? 0,
                ':deduct_advance' => $data['deductAdvance'] ?? 0,
                ':deduct_loan' => $data['deductLoan'] ?? 0,
                ':deduct_fine' => $data['deductFine'] ?? 0,
                ':approval_status' => $data['approvalStatus'] ?? 'Approved',
                ':approved_by' => $data['approvedBy'] ?? null,
                ':process_date' => $data['payDate']
            ]);
            echo json_encode(['status' => 'success']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'save_settings':
        $data = getPostData();
        try {
            $stmt = $pdo->prepare("
                UPDATE admin_settings
                SET password = :password,
                    login_enabled = :login_enabled,
                    company_name = :company_name,
                    company_address = :company_address,
                    company_phone = :company_phone,
                    company_logo = :company_logo,
                    theme = :theme,
                    color_theme = :color_theme,
                    day_range = :day_range
                WHERE id = 1
            ");
            $stmt->execute([
                ':password' => $data['password'] ?? '',
                ':login_enabled' => !empty($data['loginEnabled']) ? 1 : 0,
                ':company_name' => $data['companyName'] ?? 'ABIRAMI INDUSTRIES',
                ':company_address' => $data['companyAddress'] ?? null,
                ':company_phone' => $data['companyPhone'] ?? null,
                ':company_logo' => $data['companyLogo'] ?? null,
                ':theme' => $data['theme'] ?? 'light',
                ':color_theme' => $data['colorTheme'] ?? 'indigo',
                ':day_range' => $data['dayRange'] ?? 6
            ]);
            echo json_encode(['status' => 'success']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'save_holiday':
        $data = getPostData();
        $date = $data['date'] ?? '';
        $occasion = $data['occasion'] ?? '';
        $delete = !empty($data['delete']);

        if (!$date) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Missing holiday date']);
            break;
        }

        try {
            if ($delete) {
                $stmt = $pdo->prepare("DELETE FROM holidays WHERE date = ?");
                $stmt->execute([$date]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO holidays (date, occasion) VALUES (?, ?) ON DUPLICATE KEY UPDATE occasion = ?");
                $stmt->execute([$date, $occasion, $occasion]);
            }
            echo json_encode(['status' => 'success']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'post_announcement':
        $data = getPostData();
        if (empty($data['id']) || empty($data['title'])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Missing ID or Title']);
            break;
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO announcements (id, date, title, content) VALUES (:id, :date, :title, :content)");
            $stmt->execute([
                ':id' => $data['id'],
                ':date' => $data['date'],
                ':title' => $data['title'],
                ':content' => $data['content']
            ]);
            echo json_encode(['status' => 'success']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'log_activity':
        $data = getPostData();
        if (empty($data['action'])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Missing action']);
            break;
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO audit_logs (timestamp, action, details, username) VALUES (:timestamp, :action, :details, :username)");
            $stmt->execute([
                ':timestamp' => $data['timestamp'] ?? date('c'),
                ':action' => $data['action'],
                ':details' => $data['details'] ?? '',
                ':username' => $data['username'] ?? 'system'
            ]);
            echo json_encode(['status' => 'success']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'clear_logs':
        try {
            $pdo->query("TRUNCATE TABLE audit_logs");
            echo json_encode(['status' => 'success']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'backup_db':
        try {
            // Compile ALL tables into a single solid backup JSON
            $tables = ['admin_settings', 'admins', 'employees', 'attendance', 'payroll_history', 'holidays', 'announcements', 'audit_logs'];
            $backupData = [];

            foreach ($tables as $tbl) {
                $stmt = $pdo->query("SELECT * FROM `$tbl`");
                $backupData[$tbl] = $stmt->fetchAll() ?: [];
            }

            echo json_encode([
                'status' => 'success',
                'data' => $backupData
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Backup compilation failed: ' . $e->getMessage()]);
        }
        break;

    case 'restore_db':
        $data = getPostData();
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid backup payload']);
            break;
        }

        try {
            $pdo->beginTransaction();
            $pdo->query("SET FOREIGN_KEY_CHECKS = 0");

            // Define keys and column mappings
            $tables = ['admin_settings', 'admins', 'employees', 'attendance', 'payroll_history', 'holidays', 'announcements', 'audit_logs'];
            
            foreach ($tables as $tbl) {
                if (!isset($data[$tbl])) continue;

                // Truncate the table
                $pdo->query("TRUNCATE TABLE `$tbl`");

                $rows = $data[$tbl];
                if (empty($rows)) continue;

                // Get column headers
                $columns = array_keys($rows[0]);
                $colStr = implode("`, `", $columns);
                $paramStr = implode(", ", array_map(function($c) { return ":$c"; }, $columns));

                $stmt = $pdo->prepare("INSERT INTO `$tbl` (`$colStr`) VALUES ($paramStr)");
                
                foreach ($rows as $row) {
                    $binds = [];
                    foreach ($columns as $c) {
                        $binds[":$c"] = $row[$c];
                    }
                    $stmt->execute($binds);
                }
            }

            $pdo->query("SET FOREIGN_KEY_CHECKS = 1");
            $pdo->commit();

            echo json_encode(['status' => 'success']);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Restore execution failed: ' . $e->getMessage()]);
        }
        break;

    case 'reset_database':
        try {
            $pdo->query("SET FOREIGN_KEY_CHECKS = 0");
            $pdo->query("TRUNCATE TABLE attendance");
            $pdo->query("TRUNCATE TABLE payroll_history");
            $pdo->query("TRUNCATE TABLE holidays");
            $pdo->query("TRUNCATE TABLE announcements");
            $pdo->query("TRUNCATE TABLE audit_logs");
            $pdo->query("TRUNCATE TABLE employees");
            $pdo->query("SET FOREIGN_KEY_CHECKS = 1");

            // Re-insert standard demo workers to avoid empty UI
            $stmt = $pdo->prepare("
                INSERT INTO employees (
                    id, name, mobile, joining_date, department, designation, address, notes, photo, status, 
                    rate_present, rate_ot, rate_absent, rate_off, category, bank_name, bank_acc, bank_ifsc
                )
                VALUES 
                ('EMP-2026-0001', 'Sathya', '9876543210', '2026-01-01', 'Production', 'Operator', 'Coimbatore, TN', 'Sathya custom rates configuration', '', 'Active', 300, 400, 0, 150, 'Permanent', 'State Bank of India', '33445566778', 'SBIN0001234'),
                ('EMP-2026-0002', 'Rajesh Kumar', '9876543211', '2026-01-02', 'Production', 'Supervisor', 'Coimbatore, TN', 'Standard rate configuration', '', 'Active', 250, 350, 0, 150, 'Permanent', 'HDFC Bank', '50100223344', 'HDFC0000456'),
                ('EMP-2026-0003', 'Amit Sharma', '9876543212', '2026-01-15', 'Quality Assurance', 'QA Specialist', 'Coimbatore, TN', 'Standard rate configuration', '', 'Active', 250, 350, 0, 150, 'Contract', 'ICICI Bank', '00120533445', 'ICIC0000789')
            ");
            $stmt->execute();
            echo json_encode(['status' => 'success']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    default:
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Action parameter invalid or omitted']);
        break;
}
