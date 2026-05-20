// ----------------------------------------------------
// Global State & Configurations
// ----------------------------------------------------
let state = {
    admin: {
        password: "",         // Base password for the console gate
        loginEnabled: false,   // Gate enabled flag
        companyName: "ABIRAMI INDUSTRIES",
        companyAddress: "Tamil Nadu, India",
        companyPhone: "+91 98765 43210",
        companyLogo: ""       // Base64 Data URL logo
    },
    employees: [],            // List of workers
    attendance: {},           // Date-keyed Attendance: { "YYYY-MM-DD": { "empId": { status, checkIn, checkOut, otHours, remarks, late } } }
    payrollLedger: {},        // Payroll Logs Ledger
    holidays: {},             // Holidays calendar: { "YYYY-MM-DD": "Occasion Label" }
    announcements: [],        // Board announcements
    auditLogs: [],            // Security logs ledger
    adminUsers: [],           // Local multi-admin users for offline mode
    
    currentWeek: '',          // Week ISO selector ("YYYY-Wxx")
    dayRange: 6,              // Workweek length (6: Mon-Sat, 7: Mon-Sun)
    activeTab: 'dashboard-section',
    activeSubTab: 'weekly-grid',
    theme: 'light',           // 'light' | 'dark'
    colorTheme: 'indigo',     // 'indigo' | 'gold' | 'emerald' | 'slate'
};

const DEFAULT_RATES = {
    sathya: { present: 300, present_ot: 400, absent: 0, off_day: 150 },
    standard: { present: 250, present_ot: 350, absent: 0, off_day: 150 }
};

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ensureStateDefaults() {
    const defaultAdmin = {
        password: "",
        loginEnabled: false,
        companyName: "ABIRAMI INDUSTRIES",
        companyAddress: "Tamil Nadu, India",
        companyPhone: "+91 98765 43210",
        companyLogo: ""
    };

    state.admin = { ...defaultAdmin, ...(state.admin || {}) };
    state.employees = Array.isArray(state.employees) ? state.employees : [];
    state.attendance = state.attendance && typeof state.attendance === 'object' ? state.attendance : {};
    state.payrollLedger = state.payrollLedger && typeof state.payrollLedger === 'object' ? state.payrollLedger : {};
    state.holidays = state.holidays && typeof state.holidays === 'object' ? state.holidays : {};
    state.announcements = Array.isArray(state.announcements) ? state.announcements : [];
    state.auditLogs = Array.isArray(state.auditLogs) ? state.auditLogs : [];
    state.adminUsers = Array.isArray(state.adminUsers) ? state.adminUsers : [];

    const defaultUsername = 'admin';
    const existingAdmin = state.adminUsers.find(user => String(user.username || '').toLowerCase() === defaultUsername);
    if (!existingAdmin) {
        state.adminUsers.unshift({
            username: defaultUsername,
            name: 'Primary Administrator',
            password: state.admin.password || '',
            role: 'Super Admin',
            created_at: new Date().toISOString()
        });
    } else {
        existingAdmin.name = existingAdmin.name || 'Primary Administrator';
        existingAdmin.role = existingAdmin.role || 'Super Admin';
        if (existingAdmin.password === undefined) existingAdmin.password = state.admin.password || '';
        existingAdmin.created_at = existingAdmin.created_at || new Date().toISOString();
    }
}

ensureStateDefaults();

// ----------------------------------------------------
// Helpers & Date Arithmetic Utilities
// ----------------------------------------------------
function formatDateYYYYMMDD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getWeekDatesRange(weekStr, numDays) {
    if (!weekStr) return [];
    const parts = weekStr.split('-W');
    const year = parseInt(parts[0], 10);
    const week = parseInt(parts[1], 10);
    
    const jan4 = new Date(year, 0, 4);
    const dayOfJan4 = jan4.getDay();
    const monOfW1 = new Date(jan4.getTime() - ((dayOfJan4 === 0 ? 7 : dayOfJan4) - 1) * 24 * 60 * 60 * 1000);
    const monday = new Date(monOfW1.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    
    const dates = [];
    for (let i = 0; i < numDays; i++) {
        const d = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
        dates.push(d);
    }
    return dates;
}

function formatDatesRangeText(dates) {
    if (!dates || dates.length === 0) return '';
    const start = dates[0];
    const end = dates[dates.length - 1];
    
    const options = { month: 'short', day: 'numeric' };
    const startStr = start.toLocaleDateString('en-US', options);
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    return `${startStr} – ${endStr}`;
}

function getFiniteCurrencyAmount(amount) {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) return 0;
    return Math.abs(numericAmount) < 0.005 ? 0 : numericAmount;
}

function formatIndianAmount(amount) {
    const numericAmount = getFiniteCurrencyAmount(amount);
    const hasPaise = Math.abs(numericAmount % 1) > 0.004;
    return numericAmount.toLocaleString('en-IN', {
        minimumFractionDigits: hasPaise ? 2 : 0,
        maximumFractionDigits: 2
    });
}

function formatPdfCurrencyText(amount) {
    const numericAmount = getFiniteCurrencyAmount(amount);
    const sign = numericAmount < 0 ? '-' : '';
    return `${sign}\u20B9${formatIndianAmount(Math.abs(numericAmount))}`;
}

function formatDisplayCurrency(amount) {
    return `\u20B9${formatIndianAmount(amount)}`;
}

function sanitizeFilePart(value) {
    return String(value || 'Report')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || 'Report';
}

function createPdfTextImage(text, options = {}) {
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const fontSize = options.fontSize || 12;
    const fontWeight = options.fontWeight || 700;
    const color = options.color || [17, 24, 39];
    const fontFamily = options.fontFamily || '"Inter", "Nirmala UI", "Segoe UI Symbol", "Arial Unicode MS", Arial, sans-serif';
    const font = `${fontWeight} ${fontSize}px ${fontFamily}`;

    ctx.font = font;
    const metrics = ctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.82;
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.24;
    const padding = Math.ceil(fontSize * 0.28);
    const cssWidth = Math.ceil(metrics.width + padding * 2);
    const cssHeight = Math.ceil(ascent + descent + padding * 2);
    const scale = Math.max(3, Math.ceil(window.devicePixelRatio || 1));

    canvas.width = cssWidth * scale;
    canvas.height = cssHeight * scale;

    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    const baseline = padding + ascent;
    ctx.fillText(text, padding, baseline);

    return {
        dataUrl: canvas.toDataURL('image/png'),
        width: cssWidth,
        height: cssHeight,
        baseline
    };
}

function drawPdfCurrencyAmount(doc, amount, x, baselineY, options = {}) {
    const fontSize = options.fontSize || 12;
    const currencyImage = createPdfTextImage(formatPdfCurrencyText(amount), {
        fontSize,
        fontWeight: options.fontWeight || 700,
        color: options.color || [17, 24, 39],
        fontFamily: options.fontFamily
    });

    if (!currencyImage) {
        doc.text(`Rs. ${formatIndianAmount(amount)}`, x, baselineY, { align: options.align || 'left' });
        return;
    }

    const maxWidth = options.maxWidth || currencyImage.width;
    const scale = currencyImage.width > maxWidth ? maxWidth / currencyImage.width : 1;
    const width = currencyImage.width * scale;
    const height = currencyImage.height * scale;
    const baseline = currencyImage.baseline * scale;
    const align = options.align || 'left';
    let drawX = x;

    if (align === 'right') {
        drawX = x - width;
    } else if (align === 'center') {
        drawX = x - width / 2;
    }

    doc.addImage(currencyImage.dataUrl, 'PNG', drawX, baselineY - baseline, width, height, undefined, 'FAST');
}

function drawPdfCurrencyAmountInCell(doc, cell, amount, options = {}) {
    const fontSize = options.fontSize || 9;
    const paddingLeft = typeof cell.padding === 'function' ? cell.padding('left') : 5;
    const paddingRight = typeof cell.padding === 'function' ? cell.padding('right') : 5;
    const align = options.align || 'right';
    const x = align === 'right' ? cell.x + cell.width - paddingRight : cell.x + paddingLeft;
    const baselineY = cell.y + cell.height / 2 + fontSize * 0.34;

    drawPdfCurrencyAmount(doc, amount, x, baselineY, {
        fontSize,
        fontWeight: options.fontWeight || 500,
        color: options.color || [17, 24, 39],
        align,
        maxWidth: Math.max(8, cell.width - paddingLeft - paddingRight)
    });
}

function getISOWeekString(date) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7; // Monday = 0
    target.setDate(target.getDate() - dayNr + 3); // Thursday
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
    const year = new Date(firstThursday).getFullYear();
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function getDatesForMonth(yearMonthStr) {
    // Format YYYY-MM
    const parts = yearMonthStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    
    const date = new Date(year, month, 1);
    const dates = [];
    while (date.getMonth() === month) {
        dates.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return dates;
}

function logActivity(action, details) {
    const log = {
        timestamp: new Date().toISOString(),
        action: action,
        details: details
    };
    state.auditLogs.unshift(log);
    if (state.auditLogs.length > 50) {
        state.auditLogs.pop();
    }
    saveStateToStorage();
    syncActivityLog(log);
    renderAuditLogs();
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast-widget');
    const toastIcon = document.getElementById('toast-icon');
    const toastMsg = document.getElementById('toast-message');
    
    toastMsg.textContent = message;
    toast.className = isError ? "toast-notification btn-danger" : "toast-notification";
    toastIcon.className = isError ? "ph-bold ph-warning" : "ph-bold ph-check-circle";
    
    toast.style.display = "flex";
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

// ----------------------------------------------------
// Database & Online Server Sync Configuration
// ----------------------------------------------------
const APP_CONFIG = window.ATTENDFLOW_CONFIG || {};
const IS_LOCAL_ENV = ['localhost', '127.0.0.1', '::1', ''].includes(window.location.hostname) || window.location.protocol === 'file:';
const IS_HOSTED_ENV = !IS_LOCAL_ENV;
const API_URL = APP_CONFIG.API_URL || (IS_HOSTED_ENV ? '/.netlify/functions/api' : 'api.php');
const CLOUD_REQUIRED = IS_HOSTED_ENV && APP_CONFIG.CLOUD_REQUIRED !== false;
const ALLOW_LOCAL_FALLBACK = IS_LOCAL_ENV || (!CLOUD_REQUIRED && APP_CONFIG.ALLOW_LOCAL_FALLBACK !== false);
const MAIN_STORAGE_KEYS = ['attendflow_complete_db', 'attendflow_employees', 'attendflow_attendance'];
let isOnline = false;
let lastLocalMutationAt = 0;
let autoSyncTimer = null;
let isRefreshingFromServer = false;
let cloudBlockerVisible = false;
let cloudWriteQueue = Promise.resolve();

function markLocalMutation() {
    lastLocalMutationAt = Date.now();
}

function clearMainLocalData() {
    MAIN_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
}

function setCloudBlocker(message) {
    if (!CLOUD_REQUIRED) return;
    cloudBlockerVisible = true;
    clearMainLocalData();

    let blocker = document.getElementById('cloud-required-overlay');
    if (!blocker) {
        blocker = document.createElement('div');
        blocker.id = 'cloud-required-overlay';
        blocker.className = 'cloud-required-overlay';
        blocker.innerHTML = `
            <div class="cloud-required-card">
                <div class="cloud-required-icon"><i class="ph-bold ph-cloud-warning"></i></div>
                <h2>Central Database Required</h2>
                <p id="cloud-required-message"></p>
                <div class="cloud-required-actions">
                    <button class="btn btn-primary" type="button" id="retry-cloud-sync-btn">
                        <i class="ph-bold ph-arrows-clockwise"></i> Retry Cloud Sync
                    </button>
                </div>
                <p class="cloud-required-note">This hosted website will not use browser localStorage for employee, attendance, salary, or report data.</p>
            </div>
        `;
        document.body.appendChild(blocker);
        document.getElementById('retry-cloud-sync-btn').addEventListener('click', () => {
            window.location.reload();
        });
    }

    const messageNode = document.getElementById('cloud-required-message');
    if (messageNode) {
        messageNode.textContent = message || 'The live domain cannot reach the central database API. Configure Netlify Supabase environment variables or point cloud.config.js to your Hostinger api.php.';
    }
    blocker.style.display = 'flex';
}

function clearCloudBlocker() {
    cloudBlockerVisible = false;
    const blocker = document.getElementById('cloud-required-overlay');
    if (blocker) blocker.style.display = 'none';
}

async function checkApiConnection() {
    try {
        const res = await fetch(`${API_URL}?action=load_state`, { method: 'GET', cache: 'no-cache' });
        const json = res.ok ? await res.json() : null;
        if (res.ok && json && json.status === 'success') {
            isOnline = true;
            updateSyncStatusBadge(true);
            clearCloudBlocker();
            return true;
        }
        if (CLOUD_REQUIRED) {
            const message = json?.message || `Cloud API returned HTTP ${res.status}.`;
            setCloudBlocker(message);
        }
    } catch (e) {
        if (CLOUD_REQUIRED) {
            setCloudBlocker(`Cloud API is not reachable at ${API_URL}. Deploy the Netlify function or set Hostinger PHP API URL in cloud.config.js.`);
        }
    }
    isOnline = false;
    updateSyncStatusBadge(false);
    return false;
}

function updateSyncStatusBadge(online) {
    const badge = document.getElementById('sync-status-badge');
    if (badge) {
        if (online) {
            badge.className = 'sync-badge online';
            badge.innerHTML = '<i class="ph-bold ph-cloud-check"></i> Live Database Synced';
        } else if (CLOUD_REQUIRED) {
            badge.className = 'sync-badge offline';
            badge.innerHTML = '<i class="ph-bold ph-cloud-warning"></i> Cloud Database Not Connected';
        } else {
            badge.className = 'sync-badge offline';
            badge.innerHTML = '<i class="ph-bold ph-cloud-slash"></i> Offline (Local Mode)';
        }
    }
}

function handleOfflineWrite(actionLabel) {
    if (!CLOUD_REQUIRED) return false;
    setCloudBlocker(`${actionLabel || 'This action'} cannot be saved because the central database is not connected. Data was not written to browser localStorage.`);
    showToast("Cloud database is not connected. Save blocked.", true);
    return true;
}

function enqueueCloudWrite(actionLabel, worker) {
    if (!isOnline) {
        handleOfflineWrite(actionLabel);
        return Promise.resolve(false);
    }

    cloudWriteQueue = cloudWriteQueue
        .then(async () => {
            if (!isOnline) {
                handleOfflineWrite(actionLabel);
                return false;
            }
            await worker();
            return true;
        })
        .catch((error) => {
            isOnline = false;
            updateSyncStatusBadge(false);
            if (CLOUD_REQUIRED) {
                setCloudBlocker(`${actionLabel || 'Cloud write'} failed: ${error.message || error}`);
            }
            console.error(`${actionLabel || 'Cloud write'} failed:`, error);
            return false;
        });

    return cloudWriteQueue;
}

// ----------------------------------------------------
// Sync APIs
// ----------------------------------------------------
async function syncEmployee(emp) {
    return enqueueCloudWrite('Employee save', async () => {
        const res = await fetch(`${API_URL}?action=save_employee`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emp)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
}

async function syncEmployeeDelete(id, mode) {
    return enqueueCloudWrite('Employee archive/delete', async () => {
        const res = await fetch(`${API_URL}?action=delete_employee`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, mode })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
}

async function syncAttendance(entries) {
    return enqueueCloudWrite('Attendance save', async () => {
        const res = await fetch(`${API_URL}?action=save_attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entries)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
}

function buildAttendanceSyncRow(date, empId, log) {
    const activeShift = document.getElementById('weekly-shift-select')?.value || log.shift || 'General';
    log.shift = log.shift || activeShift;

    return {
        date,
        empId,
        status: log.status,
        checkIn: log.checkIn || '',
        checkOut: log.checkOut || '',
        otHours: log.otHours || 0,
        late: log.late ? 1 : 0,
        lateMinutes: log.lateMinutes || 0,
        remarks: log.remarks || '',
        shift: log.shift,
        isLocked: log.isLocked ? 1 : 0,
        isApproved: log.isApproved === false ? 0 : 1
    };
}

async function syncPayroll(payrollData) {
    return enqueueCloudWrite('Payroll save', async () => {
        const res = await fetch(`${API_URL}?action=save_payroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payrollData)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
}

async function syncSettings() {
    return enqueueCloudWrite('Settings save', async () => {
        const payload = {
            password: state.admin.password,
            loginEnabled: state.admin.loginEnabled,
            companyName: state.admin.companyName,
            companyAddress: state.admin.companyAddress,
            companyPhone: state.admin.companyPhone,
            companyLogo: state.admin.companyLogo,
            theme: state.theme,
            colorTheme: state.colorTheme,
            dayRange: state.dayRange
        };
        const res = await fetch(`${API_URL}?action=save_settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
}

async function syncHoliday(date, occasion, isDelete = false) {
    return enqueueCloudWrite('Holiday save', async () => {
        const res = await fetch(`${API_URL}?action=save_holiday`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, occasion, delete: isDelete })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
}

async function syncAnnouncement(ann) {
    return enqueueCloudWrite('Announcement save', async () => {
        const res = await fetch(`${API_URL}?action=post_announcement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ann)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
}

async function syncActivityLog(log) {
    return enqueueCloudWrite('Activity log save', async () => {
        const res = await fetch(`${API_URL}?action=log_activity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(log)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
}

async function syncAdminUser(adminData) {
    return enqueueCloudWrite('Admin user save', async () => {
        const res = await fetch(`${API_URL}?action=save_admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adminData)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
}

async function syncAdminDelete(username) {
    return enqueueCloudWrite('Admin user delete', async () => {
        const res = await fetch(`${API_URL}?action=delete_admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
}

async function postJsonAction(action, payload = {}) {
    const res = await fetch(`${API_URL}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === 'error') {
        throw new Error(json.message || `Server action failed: ${action}`);
    }
    return json;
}

function getAllAttendanceSyncRows() {
    const rows = [];
    for (const date in state.attendance) {
        for (const empId in state.attendance[date]) {
            rows.push(buildAttendanceSyncRow(date, empId, state.attendance[date][empId]));
        }
    }
    return rows;
}

function getLegacyLocalState() {
    try {
        const storedState = localStorage.getItem('attendflow_complete_db');
        if (storedState) {
            const parsed = JSON.parse(storedState);
            return parsed && typeof parsed === 'object' ? parsed : null;
        }

        const storedEmployees = localStorage.getItem('attendflow_employees');
        const storedAttendance = localStorage.getItem('attendflow_attendance');
        if (storedEmployees || storedAttendance) {
            return {
                employees: storedEmployees ? JSON.parse(storedEmployees) : [],
                attendance: storedAttendance ? JSON.parse(storedAttendance) : {},
                payrollLedger: {},
                holidays: {},
                announcements: [],
                auditLogs: []
            };
        }
    } catch (error) {
        console.warn("Legacy local data could not be parsed for migration:", error);
    }
    return null;
}

function stateHasBusinessData(candidate) {
    if (!candidate || typeof candidate !== 'object') return false;
    const hasEmployees = Array.isArray(candidate.employees) && candidate.employees.length > 0;
    const hasAttendance = candidate.attendance && Object.keys(candidate.attendance).length > 0;
    const hasPayroll = candidate.payrollLedger && Object.keys(candidate.payrollLedger).length > 0;
    return !!(hasEmployees || hasAttendance || hasPayroll);
}

async function migrateLocalStateToCloudIfNeeded(serverState) {
    if (!isOnline || APP_CONFIG.AUTO_MIGRATE_LOCAL_TO_CLOUD === false) return serverState;
    if (stateHasBusinessData(serverState)) {
        clearMainLocalData();
        return serverState;
    }

    const localState = getLegacyLocalState();
    if (!stateHasBusinessData(localState)) {
        clearMainLocalData();
        return serverState;
    }

    const migratedState = {
        ...serverState,
        ...localState,
        admin: { ...(serverState.admin || {}), ...(localState.admin || {}) }
    };
    const result = await postJsonAction('save_state', migratedState);
    clearMainLocalData();
    showToast("Local browser data migrated to central cloud database.");
    return result.data || migratedState;
}

async function syncFullStateToServer() {
    if (!isOnline) {
        handleOfflineWrite('Full database migration');
        return;
    }
    await syncSettings();
    for (const emp of state.employees) {
        await syncEmployee(emp);
    }
    const attendanceRows = getAllAttendanceSyncRows();
    for (let i = 0; i < attendanceRows.length; i += 100) {
        await syncAttendance(attendanceRows.slice(i, i + 100));
    }
    for (const period in state.payrollLedger) {
        for (const empId in state.payrollLedger[period]) {
            await syncPayroll(state.payrollLedger[period][empId]);
        }
    }
    for (const date in state.holidays) {
        await syncHoliday(date, state.holidays[date]);
    }
    for (const ann of state.announcements) {
        await syncAnnouncement(ann);
    }
}

// ----------------------------------------------------
// Storage & Legacy Data Migration
// ----------------------------------------------------
async function loadStateFromStorage() {
    const online = await checkApiConnection();
    if (online) {
        try {
            const res = await fetch(`${API_URL}?action=load_state`);
            const json = await res.json();
            if (json.status === 'success') {
                const cloudState = await migrateLocalStateToCloudIfNeeded(json.data);
                applyServerState(cloudState, { preserveView: true });
                return;
            }
        } catch (err) {
            console.warn("Failed to fetch state from server", err);
            if (CLOUD_REQUIRED) {
                setCloudBlocker("The central database API responded, but state could not be loaded. Browser localStorage fallback is disabled on hosted domains.");
                ensureStateDefaults();
                return;
            }
        }
    }

    if (!ALLOW_LOCAL_FALLBACK) {
        clearMainLocalData();
        setCloudBlocker("Central database is not connected. Browser localStorage fallback is disabled to prevent different data on different computers.");
        ensureStateDefaults();
        return;
    }

    try {
        const storedState = localStorage.getItem('attendflow_complete_db');
        if (storedState) {
            const parsed = JSON.parse(storedState);
            state = { ...state, ...parsed };
        } else {
            // Load base keys from old schema if exists
            const storedEmployees = localStorage.getItem('attendflow_employees');
            const storedAttendance = localStorage.getItem('attendflow_attendance');
            
            if (storedEmployees) state.employees = JSON.parse(storedEmployees);
            if (storedAttendance) state.attendance = JSON.parse(storedAttendance);
        }

        ensureStateDefaults();
        
        // Add defaults if employee roster empty
        if (state.employees.length === 0) {
            state.employees = [
                { id: 'EMP-2026-0001', name: 'Sathya', mobile: '9876543210', department: 'Production', designation: 'Operator', joiningDate: '2026-01-01', address: 'Coimbatore, TN', status: 'Active', notes: 'Sathya rates configuration', rates: { ...DEFAULT_RATES.sathya }, photo: '' },
                { id: 'EMP-2026-0002', name: 'Rajesh Kumar', mobile: '9876543211', department: 'Production', designation: 'Supervisor', joiningDate: '2026-01-02', address: 'Coimbatore, TN', status: 'Active', notes: 'Standard supervisor rate', rates: { ...DEFAULT_RATES.standard }, photo: '' },
                { id: 'EMP-2026-0003', name: 'Amit Sharma', mobile: '9876543212', department: 'Quality Assurance', designation: 'QA Specialist', joiningDate: '2026-01-15', address: 'Coimbatore, TN', status: 'Active', notes: 'Standard QA rate', rates: { ...DEFAULT_RATES.standard }, photo: '' }
            ];
            saveStateToStorage();
        }

        migrateLegacyAttendance();
    } catch (e) {
        console.error('Error reading localStorage:', e);
    }
}

function applyServerState(data, options = {}) {
    const preserveView = options.preserveView !== false;
    const viewState = {
        currentWeek: state.currentWeek,
        activeTab: state.activeTab,
        activeSubTab: state.activeSubTab,
        currentUser: state.currentUser
    };

    state.admin = { ...state.admin, ...(data.admin || {}) };
    state.adminUsers = data.adminUsers || state.adminUsers || [];
    state.employees = data.employees || [];
    state.attendance = data.attendance || {};
    state.payrollLedger = data.payrollLedger || {};
    state.holidays = data.holidays || {};
    state.announcements = data.announcements || [];
    state.auditLogs = data.auditLogs || [];
    ensureStateDefaults();

    state.theme = state.admin.theme || 'light';
    state.colorTheme = state.admin.colorTheme || 'indigo';
    state.dayRange = state.admin.dayRange || 6;

    if (preserveView) {
        state.currentWeek = viewState.currentWeek || state.currentWeek;
        state.activeTab = viewState.activeTab || state.activeTab;
        state.activeSubTab = viewState.activeSubTab || state.activeSubTab;
        state.currentUser = viewState.currentUser || state.currentUser;
    }
}

function saveStateToStorage() {
    try {
        ensureStateDefaults();
        markLocalMutation();
        if (!ALLOW_LOCAL_FALLBACK) {
            clearMainLocalData();
            return;
        }
        localStorage.setItem('attendflow_complete_db', JSON.stringify(state));
        localStorage.setItem('attendflow_employees', JSON.stringify(state.employees));
    } catch(e) {
        console.error("Local storage save error", e);
    }
}

function isModalOpen() {
    return !!document.querySelector('.modal-overlay.active, .modal.active');
}

async function refreshStateFromServer({ silent = true, force = false } = {}) {
    if (isRefreshingFromServer) return false;
    if (!force && Date.now() - lastLocalMutationAt < 5000) return false;
    if (!force && isModalOpen()) return false;

    isRefreshingFromServer = true;
    try {
        const res = await fetch(`${API_URL}?action=load_state`, { method: 'GET', cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message || 'Invalid sync response');

        applyServerState(json.data, { preserveView: true });
        isOnline = true;
        updateSyncStatusBadge(true);
        renderAll();
        return true;
    } catch (e) {
        isOnline = false;
        updateSyncStatusBadge(false);
        if (CLOUD_REQUIRED) {
            setCloudBlocker("Cloud sync failed. The live site is blocked from using local browser data to avoid mismatched payouts across devices.");
        } else if (!silent) {
            showToast("Cloud sync unavailable. Offline backup mode is active.", true);
        }
        return false;
    } finally {
        isRefreshingFromServer = false;
    }
}

function startAutoSync() {
    if (autoSyncTimer) clearInterval(autoSyncTimer);
    autoSyncTimer = setInterval(() => {
        refreshStateFromServer({ silent: true });
    }, 15000);
}

function migrateLegacyAttendance() {
    try {
        // Detect if state.attendance keys are week-based ("2026-Wxx") instead of date-based ("YYYY-MM-DD")
        let isLegacy = false;
        for (const key in state.attendance) {
            if (key.includes('-W')) {
                const weekData = state.attendance[key];
                for (const empId in weekData) {
                    const empDays = weekData[empId];
                    if (empDays && ('Mon' in empDays || 'Tue' in empDays)) {
                        isLegacy = true;
                        break;
                    }
                }
            }
            if (isLegacy) break;
        }

        if (isLegacy) {
            console.log("Legacy attendance format detected. Migrating records to Daily Date-keyed scheme...");
            let newAttendance = {};
            
            for (const weekStr in state.attendance) {
                const weekData = state.attendance[weekStr];
                const dates = getWeekDatesRange(weekStr, 7); // Mon-Sun
                const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

                for (const empId in weekData) {
                    const empDays = weekData[empId];
                    for (let i = 0; i < 7; i++) {
                        const dayKey = dayKeys[i];
                        const status = empDays[dayKey];
                        const dateObj = dates[i];
                        if (status && dateObj) {
                            const dateStr = formatDateYYYYMMDD(dateObj);
                            if (!newAttendance[dateStr]) {
                                newAttendance[dateStr] = {};
                            }
                            let otHours = 0;
                            let checkOut = "18:00";
                            if (status === 'Present + OT') {
                                otHours = 2;
                                checkOut = "20:00";
                            }
                            newAttendance[dateStr][empId] = {
                                status: status,
                                checkIn: status === 'Absent' ? "" : "09:00",
                                checkOut: status === 'Absent' ? "" : checkOut,
                                otHours: otHours,
                                remarks: "",
                                late: false
                            };
                        }
                    }
                }
            }
            state.attendance = { ...newAttendance, ...state.attendance }; // Merge any newer date-keyed logs
            // Clean up legacy week keys
            for (const key in state.attendance) {
                if (key.includes('-W')) {
                    delete state.attendance[key];
                }
            }
            saveStateToStorage();
            console.log("Legacy data migration accomplished successfully!");
        }
    } catch (e) {
        console.error("Migration helper error:", e);
    }
}

// ----------------------------------------------------
// Navigation Router & Tabs Switcher
// ----------------------------------------------------
function setupNavigation() {
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            switchView(target);
            // Close mobile menu after selection
            if (window.innerWidth <= 1024) {
                closeMobileMenu();
            }
        });
    });

    // Mobile menu toggle
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');
    const sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
    const mainContent = document.querySelector('.main-content');
    
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
        });
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            closeMobileMenu();
        });
    }
    
    // Sidebar collapse/expand toggle
    if (sidebarCollapseBtn) {
        sidebarCollapseBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('collapsed');
        });
    }

    // Attendance desk Sub-Tabs Click
    document.querySelectorAll('#attendance-section .sub-tabs-bar button').forEach(subBtn => {
        subBtn.addEventListener('click', () => {
            const subTab = subBtn.getAttribute('data-subtab');
            switchSubTab('attendance-section', subTab);
        });
    });

    // Payroll hub Sub-Tabs Click
    document.querySelectorAll('#payroll-section .sub-tabs-bar button').forEach(subBtn => {
        subBtn.addEventListener('click', () => {
            const subTab = subBtn.getAttribute('data-subtab');
            switchSubTab('payroll-section', subTab);
        });
    });
}

function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
}

function switchView(sectionId, targetSubTab = null) {
    state.activeTab = sectionId;
    saveStateToStorage();

    // Toggle active sidebar highlight
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-target') === sectionId) {
            btn.classList.add('active');
        }
    });

    // Toggle content panels
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    const activeSection = document.getElementById(sectionId);
    if (activeSection) activeSection.classList.add('active');

    // Header dynamic labels
    const title = document.getElementById('section-title');
    const subtitle = document.getElementById('section-subtitle');
    const weekPicker = document.getElementById('global-week-picker');

    weekPicker.style.display = 'none';

    if (sectionId === 'dashboard-section') {
        title.textContent = 'Dashboard Overview';
        subtitle.textContent = 'Real-time indicators & company overview';
        renderDashboardOverview();
    } else if (sectionId === 'attendance-section') {
        title.textContent = 'Attendance Desk';
        subtitle.textContent = 'Weekly matrices, yearly archives & calendar scheduling';
        weekPicker.style.display = 'flex';
        
        const initialSubTab = targetSubTab || state.activeSubTab || 'weekly-grid';
        switchSubTab('attendance-section', initialSubTab);
    } else if (sectionId === 'employees-section') {
        title.textContent = 'Workers Directory';
        subtitle.textContent = 'Roster management, details customization & rates editing';
        renderEmployeesList();
    } else if (sectionId === 'payroll-section') {
        title.textContent = 'Payroll Hub';
        subtitle.textContent = 'Incentives adjustments, advances ledger & salary vouchers approval';
        weekPicker.style.display = 'flex';
        const initialSubTab = targetSubTab || 'payroll-calculator';
        switchSubTab('payroll-section', initialSubTab);
    } else if (sectionId === 'reports-section') {
        title.textContent = 'Reports & Analytics';
        subtitle.textContent = 'Custom bulk compilers, Excel sheets & cost summaries';
        renderReportsPanel();
    } else if (sectionId === 'settings-section') {
        title.textContent = 'System Settings';
        subtitle.textContent = 'Branding variables, lock code & backup database tools';
        loadSettingsFormValues();
    }
}

function switchSubTab(parentSectionId, subTabId) {
    state.activeSubTab = subTabId;
    saveStateToStorage();

    // Reset Sub-Tab Menu indicators
    document.querySelectorAll(`#${parentSectionId} .sub-tabs-bar button`).forEach(btn => {
        btn.classList.remove('sub-tabactive');
        if (btn.getAttribute('data-subtab') === subTabId) {
            btn.classList.add('sub-tabactive');
        }
    });

    // Reset Subtab Panel Visibility
    document.querySelectorAll(`#${parentSectionId} .subtab-content`).forEach(content => {
        content.classList.remove('active-subtab');
    });
    const activeSubContent = document.getElementById(`subtab-content-${subTabId}`);
    if (activeSubContent) activeSubContent.classList.add('active-subtab');

    // Run custom render routine based on sub-tab ID
    if (subTabId === 'weekly-grid') {
        renderWeeklyGrid();
    } else if (subTabId === 'monthly-log') {
        renderMonthlyLogSelector();
    } else if (subTabId === 'yearly-log') {
        renderYearlyAttendanceGrid();
    } else if (subTabId === 'holiday-calendar') {
        renderHolidaysDesk();
    } else if (subTabId === 'payroll-calculator') {
        setupPayrollCalculatorTab();
    } else if (subTabId === 'payroll-history') {
        renderPayrollHistoryLedger();
    }
}

// ----------------------------------------------------
// Dashboard Overview Render Engines
// ----------------------------------------------------
function renderDashboardOverview() {
    // 1. Calculate and show statistics banners
    const dates = getWeekDatesRange(state.currentWeek, state.dayRange);
    let totalPayout = 0;
    let totalPresent = 0;
    let totalOTDays = 0;
    let totalAbsent = 0;
    let totalOff = 0;
    let totalLate = 0;
    let totalOTHrs = 0;

    dates.forEach(d => {
        const dateStr = formatDateYYYYMMDD(d);
        const dayLogs = state.attendance[dateStr] || {};
        
        state.employees.forEach(emp => {
            if (emp.status === 'Archived') return; // Skip archived workers
            const log = dayLogs[emp.id];
            const status = log ? log.status : 'Present'; // prefill Present default
            
            // Increment counters
            if (status === 'Present') totalPresent++;
            else if (status === 'Present + OT') {
                totalPresent++;
                totalOTDays++;
                totalOTHrs += (log.otHours || 2);
            }
            else if (status === 'Absent') totalAbsent++;
            else if (status === 'Off Day') totalOff++;
            else if (status === 'Half Day') totalPresent += 0.5;

            // Late markings
            if (log && log.late) totalLate++;

            // Simple payout estimate
            const rates = emp.rates;
            if (status === 'Present') totalPayout += rates.present;
            else if (status === 'Present + OT') totalPayout += rates.present_ot;
            else if (status === 'Absent') totalPayout += rates.absent;
            else if (status === 'Off Day') totalPayout += rates.off_day;
            else if (status === 'Half Day') totalPayout += (rates.present / 2);
        });
    });

    const activeEmps = state.employees.filter(e => e.status === 'Active').length;
    const totalEmps = state.employees.length;
    const archivedEmps = state.employees.filter(e => e.status === 'Archived').length;
    
    const maxDays = dates.length * activeEmps;
    const avgAttendance = maxDays > 0 ? ((totalPresent / maxDays) * 100).toFixed(1) : 0;

    document.getElementById('stat-total-payout').textContent = `₹${totalPayout.toLocaleString('en-IN')}`;
    document.getElementById('stat-present-count').textContent = totalPresent;
    document.getElementById('stat-ot-count').textContent = totalOTDays;
    document.getElementById('stat-absent-count').textContent = totalAbsent;
    document.getElementById('stat-off-count').textContent = totalOff;
    document.getElementById('stat-avg-attendance').textContent = `${avgAttendance}%`;
    document.getElementById('stat-active-employees').textContent = activeEmps;
    document.getElementById('stat-total-ot-hrs').textContent = `${totalOTHrs} hrs`;
    document.getElementById('stat-late-markings').textContent = totalLate;

    // 2. Render Canvas Analytics Graph
    renderDashboardChart();

    // 3. Render Announcements
    renderAnnouncementsList();

    // 4. Render Audit Log Records
    renderAuditLogs();
    
    // 5. Render Department-wise Statistics
    renderDepartmentStats();
    
    // 6. Render Recent Activity Widget
    renderRecentActivityWidget();
}

function renderAnnouncementsList() {
    const list = document.getElementById('announcements-list');
    list.innerHTML = "";
    if (state.announcements.length === 0) {
        list.innerHTML = `<div class="empty-list-notice">No company notices posted yet.</div>`;
        return;
    }
    state.announcements.forEach(ann => {
        const card = document.createElement('div');
        card.className = "announcement-card";
        card.innerHTML = `
            <h4>${escapeHTML(ann.title)}</h4>
            <p>${escapeHTML(ann.content)}</p>
            <span class="post-time">${new Date(ann.date).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
        `;
        list.appendChild(card);
    });
}

function renderAuditLogs() {
    const list = document.getElementById('audit-logs-list');
    list.innerHTML = "";
    if (state.auditLogs.length === 0) {
        list.innerHTML = `<div class="empty-list-notice">No logs recorded.</div>`;
        return;
    }
    state.auditLogs.forEach(log => {
        const entry = document.createElement('div');
        let modifier = "";
        if (log.action.includes("Delete") || log.action.includes("Reset")) modifier = "log-danger";
        else if (log.action.includes("Save") || log.action.includes("Backup")) modifier = "log-success";
        else if (log.action.includes("Edit") || log.action.includes("Update")) modifier = "log-warning";
        
        entry.className = `log-entry ${modifier}`;
        entry.innerHTML = `
            <span class="time">${new Date(log.timestamp).toLocaleTimeString('en-IN')}</span>
            <strong>${escapeHTML(log.action)}:</strong> ${escapeHTML(log.details)}
        `;
        list.appendChild(entry);
    });
}

function renderDepartmentStats() {
    const container = document.getElementById('department-stats-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    const departments = {};
    state.employees.forEach(emp => {
        if (emp.status === 'Archived') return;
        if (!departments[emp.department]) {
            departments[emp.department] = { count: 0, present: 0, absent: 0, ot: 0 };
        }
        departments[emp.department].count++;
    });
    
    const dates = getWeekDatesRange(state.currentWeek, state.dayRange);
    dates.forEach(d => {
        const dateStr = formatDateYYYYMMDD(d);
        const dayLogs = state.attendance[dateStr] || {};
        
        state.employees.forEach(emp => {
            if (emp.status === 'Archived') return;
            const log = dayLogs[emp.id];
            const status = log ? log.status : 'Present';
            
            if (departments[emp.department]) {
                if (status === 'Present' || status === 'Present + OT' || status === 'Half Day' || status === 'Holiday') {
                    departments[emp.department].present++;
                }
                if (status === 'Absent') {
                    departments[emp.department].absent++;
                }
                if (status === 'Present + OT') {
                    departments[emp.department].ot++;
                }
            }
        });
    });
    
    const departmentNames = Object.keys(departments);
    if (departmentNames.length === 0) {
        container.innerHTML = `<div class="empty-list-notice" style="padding: 20px;">No active departments yet. Add employees to populate department analytics.</div>`;
        return;
    }

    departmentNames.forEach(dept => {
        const stats = departments[dept];
        const card = document.createElement('div');
        card.className = 'dept-stat-card glass-card';
        card.innerHTML = `
            <h4>${escapeHTML(dept)}</h4>
            <div class="dept-stat-row">
                <span>Employees:</span>
                <strong>${stats.count}</strong>
            </div>
            <div class="dept-stat-row">
                <span>Present:</span>
                <strong style="color: var(--success);">${stats.present}</strong>
            </div>
            <div class="dept-stat-row">
                <span>Absent:</span>
                <strong style="color: var(--danger);">${stats.absent}</strong>
            </div>
            <div class="dept-stat-row">
                <span>OT Days:</span>
                <strong style="color: var(--status-present-ot);">${stats.ot}</strong>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderRecentActivityWidget() {
    const container = document.getElementById('recent-activity-widget');
    if (!container) return;
    
    container.innerHTML = '';
    
    const recentLogs = state.auditLogs.slice(0, 5);
    
    if (recentLogs.length === 0) {
        container.innerHTML = `<div class="empty-list-notice" style="padding: 20px;">No recent activity.</div>`;
        return;
    }
    
    recentLogs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-icon">
                <i class="ph-bold ${getActivityIcon(log.action)}"></i>
            </div>
            <div class="activity-content">
                <span class="activity-action">${escapeHTML(log.action)}</span>
                <span class="activity-time">${new Date(log.timestamp).toLocaleString('en-IN')}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

function getActivityIcon(action) {
    if (action.includes('Add')) return 'ph-plus-circle';
    if (action.includes('Edit') || action.includes('Update')) return 'ph-pencil-simple';
    if (action.includes('Delete') || action.includes('Remove')) return 'ph-trash';
    if (action.includes('Save') || action.includes('Backup')) return 'ph-floppy-disk';
    if (action.includes('Login') || action.includes('Logout')) return 'ph-sign-in';
    if (action.includes('Post')) return 'ph-megaphone';
    return 'ph-info';
}

function renderDashboardChart() {
    const canvas = document.getElementById('dashboard-analytics-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Compute last 6 weeks stats
    const lastWeeks = [];
    const parts = state.currentWeek.split('-W');
    const year = parseInt(parts[0], 10);
    const week = parseInt(parts[1], 10);
    
    for (let i = 5; i >= 0; i--) {
        let w = week - i;
        let y = year;
        if (w < 1) {
            w = 52 + w;
            y--;
        }
        lastWeeks.push(`${y}-W${String(w).padStart(2, '0')}`);
    }

    const attendancePercentages = [];
    const otCounts = [];

    lastWeeks.forEach(wStr => {
        const dates = getWeekDatesRange(wStr, state.dayRange);
        let activeEmps = state.employees.filter(e => e.status === 'Active').length;
        if (activeEmps === 0) activeEmps = 1;
        
        let presentSum = 0;
        let otSum = 0;
        
        dates.forEach(d => {
            const dateStr = formatDateYYYYMMDD(d);
            const logs = state.attendance[dateStr] || {};
            for (const empId in logs) {
                const s = logs[empId].status;
                if (s === 'Present') presentSum++;
                else if (s === 'Present + OT') {
                    presentSum++;
                    otSum++;
                } else if (s === 'Half Day') {
                    presentSum += 0.5;
                }
            }
        });
        
        const maxDays = dates.length * activeEmps;
        const rate = maxDays > 0 ? (presentSum / maxDays) * 100 : 0;
        attendancePercentages.push(rate);
        otCounts.push(otSum);
    });

    // Drawing configuration dimensions
    const padding = 40;
    const chartW = canvas.width - (padding * 2);
    const chartH = canvas.height - (padding * 2);
    
    // Draw Axis
    ctx.strokeStyle = state.theme === 'dark' ? '#475569' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();

    // Axis labels font
    ctx.fillStyle = state.theme === 'dark' ? '#cbd5e1' : '#334155';
    ctx.font = "bold 9px sans-serif";
    
    // Draw Y Axis indicators (0 to 100%)
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
        const val = (100 / ySteps) * i;
        const y = canvas.height - padding - ((chartH / ySteps) * i);
        ctx.fillText(`${Math.round(val)}%`, padding - 30, y + 3);
        
        // Draw dotted lines grid
        ctx.strokeStyle = state.theme === 'dark' ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.4)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(canvas.width - padding, y);
        ctx.stroke();
    }

    // Draw weeks on X axis & bars
    const barSpacing = chartW / lastWeeks.length;
    for (let i = 0; i < lastWeeks.length; i++) {
        const wName = lastWeeks[i].split('-W')[1];
        const x = padding + (barSpacing * i) + (barSpacing / 2);
        
        // Label week code
        ctx.fillStyle = state.theme === 'dark' ? '#cbd5e1' : '#334155';
        ctx.fillText(`Wk ${wName}`, x - 14, canvas.height - padding + 15);
        
        // 1. Draw Present rate line/bar
        const rate = attendancePercentages[i];
        const barH = (rate / 100) * chartH;
        const y = canvas.height - padding - barH;
        
        // Draw bar
        const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary').trim() || '#2563eb';
        ctx.fillStyle = primaryColor;
        ctx.fillRect(x - 16, y, 12, barH);
        
        // 2. Draw Overtime counts as a secondary orange bar
        const otVal = otCounts[i];
        const maxOTPossible = state.dayRange * state.employees.length;
        const otH = maxOTPossible > 0 ? (otVal / maxOTPossible) * chartH : 0;
        const otY = canvas.height - padding - otH;
        
        ctx.fillStyle = "#7c3aed"; // Overtime Violet accent
        ctx.fillRect(x - 2, otY, 12, otH);
    }
}

// ----------------------------------------------------
// Workers Directory Operations
// ----------------------------------------------------
function renderEmployeesList() {
    const container = document.getElementById('employees-list-container');
    const emptyState = document.getElementById('employees-empty-state');
    const searchStr = document.getElementById('employee-search').value.toLowerCase().trim();
    const statusFilter = document.getElementById('employee-status-filter').value;
    const categoryFilter = document.getElementById('employee-category-filter')?.value || 'All';

    container.innerHTML = '';

    // Filter list
    const filtered = state.employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchStr) || 
                              emp.id.toLowerCase().includes(searchStr) ||
                              emp.department.toLowerCase().includes(searchStr) ||
                              emp.designation.toLowerCase().includes(searchStr);
                              
        const matchesStatus = (statusFilter === 'All') || (emp.status === statusFilter);
        const matchesCategory = (categoryFilter === 'All') || ((emp.category || 'Permanent') === categoryFilter);
        return matchesSearch && matchesStatus && matchesCategory;
    });

    if (filtered.length === 0) {
        emptyState.style.display = 'flex';
        container.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    container.style.display = 'grid';

    filtered.forEach(emp => {
        const card = document.createElement('div');
        const isArchived = emp.status === 'Archived';
        card.className = `employee-card ${isArchived ? 'archived-card' : ''}`;
        
        const avatar = emp.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';
        
        card.innerHTML = `
            <div class="employee-card-header">
                <div class="employee-avatar-wrapper">
                    <img src="${avatar}" alt="Avatar">
                    <div class="employee-info-main">
                        <h4>${escapeHTML(emp.name)}</h4>
                        <span>${emp.id} ${isArchived ? '(Archived)' : ''}</span>
                    </div>
                </div>
                <div class="employee-actions-dropdown">
                    <button class="btn-mini edit-btn-mini" onclick="app.openEditModal('${emp.id}')" title="Edit Roster File">
                        <i class="ph-bold ph-pencil-simple"></i>
                        <span class="btn-label">Edit</span>
                    </button>
                    <button class="btn-mini ${isArchived ? 'restore-btn-mini' : 'archive-btn-mini'}" onclick="app.toggleArchiveEmployee('${emp.id}')" title="${isArchived ? 'Restore Employee' : 'Archive Employee'}">
                        <i class="ph-bold ${isArchived ? 'ph-user-plus' : 'ph-archive'}"></i>
                        <span class="btn-label">${isArchived ? 'Restore' : 'Archive'}</span>
                    </button>
                    <button class="btn-mini hard-delete-btn-mini" onclick="app.hardDeleteEmployee('${emp.id}')" title="Hard Delete Record">
                        <i class="ph-bold ph-trash"></i>
                        <span class="btn-label">Delete</span>
                    </button>
                </div>
            </div>
            
            <div class="employee-card-details-list">
                <div class="card-details-row"><i class="ph ph-phone"></i> <span>${escapeHTML(emp.mobile || 'N/A')}</span></div>
                <div class="card-details-row"><i class="ph ph-briefcase"></i> <span>${escapeHTML(emp.designation)} (${escapeHTML(emp.department)})</span></div>
                <div class="card-details-row"><i class="ph ph-calendar"></i> <span>Joined: ${emp.joiningDate || 'N/A'}</span></div>
                <div class="card-details-row"><i class="ph ph-map-pin"></i> <span>${escapeHTML(emp.address || 'N/A')}</span></div>
            </div>

            <div class="wages-summary-list">
                <div class="wage-item">
                    <span class="wage-name"><i class="ph ph-check-square present-i"></i> Regular Rate</span>
                    <span class="wage-amount">₹${emp.rates.present}</span>
                </div>
                <div class="wage-item">
                    <span class="wage-name"><i class="ph ph-plus-circle ot-i"></i> Overtime (OT)</span>
                    <span class="wage-amount">₹${emp.rates.present_ot}</span>
                </div>
                <div class="wage-item">
                    <span class="wage-name"><i class="ph ph-calendar-x off-i"></i> Scheduled Off</span>
                    <span class="wage-amount">₹${emp.rates.off_day}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function setupEmployeeForm() {
    const form = document.getElementById('employee-form');
    const closeBtn = document.getElementById('close-employee-modal');
    const cancelBtn = document.getElementById('cancel-employee-btn');
    const nameInput = document.getElementById('employee-name');
    const photoInput = document.getElementById('employee-photo-input');
    const photoPreview = document.getElementById('employee-photo-preview');
    const aadhaarInput = document.getElementById('employee-aadhaar-upload');
    const idProofInput = document.getElementById('employee-id-proof-upload');
    
    // Bind Add New Employee button from Workers Directory
    const addWorkerBtn = document.getElementById('open-add-employee-modal');
    if (addWorkerBtn) addWorkerBtn.addEventListener('click', () => openModal());
    const emptyStateAddBtn = document.getElementById('empty-state-add-btn');
    if (emptyStateAddBtn) emptyStateAddBtn.addEventListener('click', () => openModal());

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveEmployeeData();
    });

    photoInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast("Please upload an image file for the employee photo.", true);
            return;
        }
        photoPreview.src = await readFileAsDataURL(file);
    });

    aadhaarInput.addEventListener('change', (e) => updateDocumentUploadLabel(e.target, 'Aadhaar'));
    idProofInput.addEventListener('change', (e) => updateDocumentUploadLabel(e.target, 'ID proof'));

    // Auto rates prefill typed names
    nameInput.addEventListener('input', (e) => {
        const isEdit = !!document.getElementById('edit-employee-id').value;
        if (!isEdit) {
            const entered = e.target.value.trim().toLowerCase();
            const config = (entered === 'sathya') ? DEFAULT_RATES.sathya : DEFAULT_RATES.standard;
            document.getElementById('rate-present').value = config.present;
            document.getElementById('rate-ot').value = config.present_ot;
            document.getElementById('rate-absent').value = config.absent;
            document.getElementById('rate-off').value = config.off_day;
        }
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function updateDocumentUploadLabel(input, label) {
    const file = input.files && input.files[0];
    if (!file) return;
    input.dataset.fileName = file.name;
    showToast(`${label} selected: ${file.name}`);
}

function openModal(empId = null) {
    const modal = document.getElementById('employee-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('employee-form');
    const photoPreview = document.getElementById('employee-photo-preview');
    
    form.reset();
    photoPreview.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';

    if (empId) {
        // Edit Mode
        const emp = state.employees.find(e => e.id === empId);
        if (emp) {
            title.textContent = `Edit Worker File: ${emp.name}`;
            document.getElementById('edit-employee-id').value = emp.id;
            document.getElementById('employee-name').value = emp.name;
            document.getElementById('employee-mobile').value = emp.mobile || "";
            document.getElementById('employee-joining-date').value = emp.joiningDate || "";
            document.getElementById('employee-department').value = emp.department || "Production";
            document.getElementById('employee-designation').value = emp.designation || "";
            document.getElementById('employee-address').value = emp.address || "";
            document.getElementById('employee-notes').value = emp.notes || "";
            document.getElementById('employee-category').value = emp.category || "Permanent";
            document.getElementById('employee-default-shift').value = emp.defaultShift || "General";
            document.getElementById('employee-bank-name').value = emp.bankName || "";
            document.getElementById('employee-bank-acc').value = emp.bankAcc || "";
            document.getElementById('employee-bank-ifsc').value = emp.bankIfsc || "";
            document.getElementById('employee-bank-branch').value = emp.bankBranch || "";
            document.getElementById('employee-emergency-name').value = emp.emergencyName || "";
            document.getElementById('employee-emergency-phone').value = emp.emergencyPhone || "";
            document.getElementById('employee-emergency-relation').value = emp.emergencyRelation || "";
            document.getElementById('employee-remarks').value = emp.remarks || "";
            document.getElementById('employee-aadhaar-upload').dataset.existingData = emp.aadhaarProof || "";
            document.getElementById('employee-id-proof-upload').dataset.existingData = emp.idProof || "";
            
            document.getElementById('rate-present').value = emp.rates.present;
            document.getElementById('rate-ot').value = emp.rates.present_ot;
            document.getElementById('rate-absent').value = emp.rates.absent;
            document.getElementById('rate-off').value = emp.rates.off_day;
            
            if (emp.photo) photoPreview.src = emp.photo;
        }
    } else {
        // Add Mode
        title.textContent = 'Add New Employee Registry';
        document.getElementById('edit-employee-id').value = '';
        document.getElementById('employee-joining-date').value = formatDateYYYYMMDD(new Date());
        document.getElementById('employee-category').value = 'Permanent';
        document.getElementById('employee-default-shift').value = 'General';
        document.getElementById('employee-aadhaar-upload').dataset.existingData = "";
        document.getElementById('employee-id-proof-upload').dataset.existingData = "";
        
        // Prefill standard default rates
        document.getElementById('rate-present').value = DEFAULT_RATES.standard.present;
        document.getElementById('rate-ot').value = DEFAULT_RATES.standard.present_ot;
        document.getElementById('rate-absent').value = DEFAULT_RATES.standard.absent;
        document.getElementById('rate-off').value = DEFAULT_RATES.standard.off_day;
    }
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('employee-modal').classList.remove('active');
}

async function saveEmployeeData() {
    const editId = document.getElementById('edit-employee-id').value;
    const name = document.getElementById('employee-name').value.trim();
    const mobile = document.getElementById('employee-mobile').value.trim();
    const joiningDate = document.getElementById('employee-joining-date').value;
    const department = document.getElementById('employee-department').value;
    const designation = document.getElementById('employee-designation').value.trim();
    const address = document.getElementById('employee-address').value.trim();
    const notes = document.getElementById('employee-notes').value.trim();
    const photo = document.getElementById('employee-photo-preview').src;
    const category = document.getElementById('employee-category').value;
    const defaultShift = document.getElementById('employee-default-shift').value;
    const bankName = document.getElementById('employee-bank-name').value.trim();
    const bankAcc = document.getElementById('employee-bank-acc').value.trim();
    const bankIfsc = document.getElementById('employee-bank-ifsc').value.trim();
    const bankBranch = document.getElementById('employee-bank-branch').value.trim();
    const emergencyName = document.getElementById('employee-emergency-name').value.trim();
    const emergencyPhone = document.getElementById('employee-emergency-phone').value.trim();
    const emergencyRelation = document.getElementById('employee-emergency-relation').value.trim();
    const remarks = document.getElementById('employee-remarks').value.trim();
    const aadhaarInput = document.getElementById('employee-aadhaar-upload');
    const idProofInput = document.getElementById('employee-id-proof-upload');
    const aadhaarProof = aadhaarInput.files[0] ? await readFileAsDataURL(aadhaarInput.files[0]) : (aadhaarInput.dataset.existingData || "");
    const idProof = idProofInput.files[0] ? await readFileAsDataURL(idProofInput.files[0]) : (idProofInput.dataset.existingData || "");

    const rates = {
        present: parseFloat(document.getElementById('rate-present').value) || 0,
        present_ot: parseFloat(document.getElementById('rate-ot').value) || 0,
        absent: parseFloat(document.getElementById('rate-absent').value) || 0,
        off_day: parseFloat(document.getElementById('rate-off').value) || 0
    };

    if (editId) {
        // Edit Mode
        const idx = state.employees.findIndex(e => e.id === editId);
        if (idx !== -1) {
            state.employees[idx] = { 
                ...state.employees[idx], 
                name, mobile, joiningDate, department, designation, address, notes, rates, photo,
                category, defaultShift, bankName, bankAcc, bankIfsc, bankBranch,
                emergencyName, emergencyPhone, emergencyRelation, remarks, aadhaarProof, idProof
            };
            syncEmployee(state.employees[idx]);
            logActivity("Edit Employee", `Updated files for employee ${name} (${editId})`);
            showToast("Employee details saved successfully.");
        }
    } else {
        // Add Mode
        const sequence = state.employees.length + 1;
        const newId = `EMP-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`;
        
        const newEmployee = {
            id: newId, name, mobile, joiningDate, department, designation, address, notes, rates, photo,
            status: 'Active', category, defaultShift, bankName, bankAcc, bankIfsc, bankBranch,
            emergencyName, emergencyPhone, emergencyRelation, remarks, aadhaarProof, idProof
        };
        
        state.employees.push(newEmployee);
        syncEmployee(newEmployee);
        logActivity("Add Employee", `Enrolled new worker ${name} (${newId})`);
        showToast("New employee added to roster.");
    }
    
    saveStateToStorage();
    closeModal();
    renderAll();
}

function toggleArchiveEmployee(empId) {
    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;
    
    const isArchiving = emp.status === 'Active';
    emp.status = isArchiving ? 'Archived' : 'Active';
    
    logActivity(isArchiving ? "Archive Employee" : "Restore Employee", `Moved ${emp.name} to ${emp.status}`);
    showToast(`Employee ${isArchiving ? 'archived' : 'restored'} successfully.`);
    syncEmployeeDelete(empId, isArchiving ? 'archive' : 'restore');
    saveStateToStorage();
    renderAll();
}

function hardDeleteEmployee(empId) {
    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;
    
    if (confirm(`CRITICAL WARNING: Are you sure you want to completely delete ${emp.name}? This will remove all their personal registries.`)) {
        state.employees = state.employees.filter(e => e.id !== empId);
        logActivity("Delete Employee", `Removed ${emp.name} from global databases`);
        showToast("Employee profile deleted.");
        syncEmployeeDelete(empId, 'delete');
        saveStateToStorage();
        renderAll();
    }
}

// ----------------------------------------------------
// Attendance Desk System
// ----------------------------------------------------
function setupAttendanceListeners() {
    const lockBtn = document.getElementById('lock-weekly-grid-btn');
    const unlockBtn = document.getElementById('unlock-weekly-grid-btn');
    const shiftSelect = document.getElementById('weekly-shift-select');
    const printMonthlyBtn = document.getElementById('print-monthly-calendar-btn');

    if (lockBtn) {
        lockBtn.addEventListener('click', () => setCurrentWeekLockState(true));
    }
    if (unlockBtn) {
        unlockBtn.addEventListener('click', () => {
            if (enforceAccessControl('Super Admin')) setCurrentWeekLockState(false);
        });
    }
    if (shiftSelect) {
        shiftSelect.addEventListener('change', () => {
            renderWeeklyGrid();
            showToast(`Shift view set to ${shiftSelect.value}.`);
        });
    }
    if (printMonthlyBtn) {
        printMonthlyBtn.addEventListener('click', () => window.print());
    }
}

function getCurrentWeekAttendanceRows() {
    const rows = [];
    const dates = getWeekDatesRange(state.currentWeek, state.dayRange);
    const activeEmps = state.employees.filter(e => e.status === 'Active');
    dates.forEach(dateObj => {
        const dateStr = formatDateYYYYMMDD(dateObj);
        if (!state.attendance[dateStr]) state.attendance[dateStr] = {};
        activeEmps.forEach(emp => {
            if (!state.attendance[dateStr][emp.id]) {
                state.attendance[dateStr][emp.id] = {
                    status: 'Present',
                    checkIn: '09:00',
                    checkOut: '18:00',
                    otHours: 0,
                    remarks: '',
                    late: false,
                    shift: emp.defaultShift || document.getElementById('weekly-shift-select')?.value || 'General',
                    isLocked: false,
                    isApproved: true
                };
            }
            rows.push({ dateStr, emp, log: state.attendance[dateStr][emp.id] });
        });
    });
    return rows;
}

function isCurrentWeekLocked() {
    return getCurrentWeekAttendanceRows().some(row => !!row.log.isLocked);
}

function updateWeeklyLockUi(isLocked) {
    const statusBar = document.getElementById('weekly-lock-status-bar');
    const lockBtn = document.getElementById('lock-weekly-grid-btn');
    if (statusBar) statusBar.style.display = isLocked ? 'flex' : 'none';
    if (lockBtn) {
        lockBtn.disabled = isLocked;
        lockBtn.innerHTML = isLocked
            ? '<i class="ph-bold ph-lock-key"></i> Grid Locked'
            : '<i class="ph-bold ph-lock-key"></i> Lock Grid & Submit';
    }
}

function setCurrentWeekLockState(isLocked) {
    const rows = getCurrentWeekAttendanceRows();
    rows.forEach(row => {
        row.log.isLocked = isLocked;
        row.log.isApproved = true;
    });
    saveStateToStorage();
    syncAttendance(rows.map(row => buildAttendanceSyncRow(row.dateStr, row.emp.id, row.log)));
    renderWeeklyGrid();
    logActivity(isLocked ? "Lock Attendance" : "Unlock Attendance", `${state.currentWeek} attendance grid ${isLocked ? 'submitted and locked' : 'reopened for edits'}`);
    showToast(isLocked ? "Attendance grid locked and submitted." : "Attendance grid unlocked for editing.");
}

function renderWeeklyGrid() {
    const headerRow = document.getElementById('table-header-row');
    const tableBody = document.getElementById('attendance-table-body');
    const emptyState = document.getElementById('attendance-empty-state');
    const table = document.getElementById('attendance-table');

    headerRow.innerHTML = '';
    tableBody.innerHTML = '';

    const activeEmps = state.employees.filter(e => e.status === 'Active');

    if (activeEmps.length === 0) {
        emptyState.style.display = 'flex';
        table.style.display = 'none';
        updateWeeklyLockUi(false);
        return;
    }

    emptyState.style.display = 'none';
    table.style.display = 'table';

    // 1. Build Header Row
    const thDetails = document.createElement('th');
    thDetails.textContent = 'Employee Details';
    thDetails.style.minWidth = '220px';
    headerRow.appendChild(thDetails);

    const dates = getWeekDatesRange(state.currentWeek, state.dayRange);
    const dayKeys = DAYS_SHORT.slice(0, state.dayRange);
    const weekLocked = isCurrentWeekLocked();
    updateWeeklyLockUi(weekLocked);

    dates.forEach((dateObj, idx) => {
        const th = document.createElement('th');
        const dName = dayKeys[idx];
        const dFmt = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        th.innerHTML = `${dName}<br><span style="font-size: 9px; opacity: 0.8;">${dFmt}</span>`;
        th.style.width = '130px';
        th.style.textAlign = 'center';
        headerRow.appendChild(th);
    });

    // Helper Stat columns
    const columns = [
        { label: 'PR' },
        { label: 'OT' },
        { label: 'AB' },
        { label: 'OFF' },
        { label: 'Net Payout' },
        { label: 'Slip' }
    ];

    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col.label;
        th.style.textAlign = 'center';
        headerRow.appendChild(th);
    });

    // 2. Build Rows for active employees
    activeEmps.forEach(emp => {
        const tr = document.createElement('tr');
        
        // Employee Info details cell
        const tdName = document.createElement('td');
        tdName.className = 'worker-cell';
        tdName.innerHTML = `
            <span class="worker-name">${escapeHTML(emp.name)}</span>
            <span class="worker-rates">
                PR: ₹${emp.rates.present} | OT: ₹${emp.rates.present_ot} | OFF: ₹${emp.rates.off_day}
            </span>
        `;
        tr.appendChild(tdName);

        // Accumulators
        let countPresent = 0;
        let countOT = 0;
        let countAbsent = 0;
        let countOff = 0;

        dates.forEach(dateObj => {
            const dateStr = formatDateYYYYMMDD(dateObj);
            if (!state.attendance[dateStr]) {
                state.attendance[dateStr] = {};
            }
            if (!state.attendance[dateStr][emp.id]) {
                state.attendance[dateStr][emp.id] = {
                    status: 'Present',
                    checkIn: '09:00',
                    checkOut: '18:00',
                    otHours: 0,
                    remarks: '',
                    late: false,
                    shift: document.getElementById('weekly-shift-select')?.value || 'General',
                    isLocked: false,
                    isApproved: true
                };
            }

            const log = state.attendance[dateStr][emp.id];
            const td = document.createElement('td');
            
            // Build visual dropdown inside cell for matrix editing
            const container = document.createElement('div');
            container.className = 'status-select-container';
            const select = document.createElement('select');
            select.className = 'status-select';
            select.disabled = weekLocked;
            
            const options = ['Present', 'Present + OT', 'Absent', 'Off Day', 'Half Day', 'Leave', 'Holiday'];
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (log.status === opt) o.selected = true;
                select.appendChild(o);
            });
            updateDropdownClass(select);

            // Late mark indicator
            const lateIndicator = document.createElement('div');
            lateIndicator.style.marginTop = '4px';
            lateIndicator.style.fontSize = '10px';
            lateIndicator.style.display = 'flex';
            lateIndicator.style.alignItems = 'center';
            lateIndicator.style.gap = '4px';
            
            const lateCheckbox = document.createElement('input');
            lateCheckbox.type = 'checkbox';
            lateCheckbox.checked = log.late || false;
            lateCheckbox.disabled = weekLocked;
            lateCheckbox.style.width = '12px';
            lateCheckbox.style.height = '12px';
            lateCheckbox.addEventListener('change', (e) => {
                log.late = e.target.checked;
                log.lateMinutes = e.target.checked ? 30 : 0;
                saveStateToStorage();
                syncAttendance([buildAttendanceSyncRow(dateStr, emp.id, log)]);
            });
            
            const lateLabel = document.createElement('span');
            lateLabel.textContent = 'Late';
            lateLabel.style.fontSize = '9px';
            lateLabel.style.color = log.late ? 'var(--warning)' : 'var(--text-muted)';
            
            lateIndicator.appendChild(lateCheckbox);
            lateIndicator.appendChild(lateLabel);

            // OT hours input
            const otContainer = document.createElement('div');
            otContainer.style.marginTop = '4px';
            otContainer.style.display = 'flex';
            otContainer.style.alignItems = 'center';
            otContainer.style.gap = '4px';
            
            const otLabel = document.createElement('span');
            otLabel.textContent = 'OT hrs:';
            otLabel.style.fontSize = '9px';
            otLabel.style.color = 'var(--text-muted)';
            
            const otInput = document.createElement('input');
            otInput.type = 'number';
            otInput.value = log.otHours || 0;
            otInput.disabled = weekLocked;
            otInput.min = '0';
            otInput.max = '12';
            otInput.step = '0.5';
            otInput.style.width = '40px';
            otInput.style.height = '20px';
            otInput.style.fontSize = '10px';
            otInput.style.padding = '2px 4px';
            otInput.style.border = '1px solid var(--border-color)';
            otInput.style.borderRadius = '4px';
            otInput.addEventListener('change', (e) => {
                log.otHours = parseFloat(e.target.value) || 0;
                saveStateToStorage();
                renderWeeklyGrid();
                syncAttendance([buildAttendanceSyncRow(dateStr, emp.id, log)]);
            });
            
            otContainer.appendChild(otLabel);
            otContainer.appendChild(otInput);

            // Remarks input
            const remarksInput = document.createElement('input');
            remarksInput.type = 'text';
            remarksInput.value = log.remarks || '';
            remarksInput.placeholder = 'Remarks...';
            remarksInput.disabled = weekLocked;
            remarksInput.style.marginTop = '4px';
            remarksInput.style.width = '100%';
            remarksInput.style.height = '18px';
            remarksInput.style.fontSize = '9px';
            remarksInput.style.padding = '2px 4px';
            remarksInput.style.border = '1px solid var(--border-color)';
            remarksInput.style.borderRadius = '4px';
            remarksInput.addEventListener('change', (e) => {
                log.remarks = e.target.value;
                saveStateToStorage();
                syncAttendance([buildAttendanceSyncRow(dateStr, emp.id, log)]);
            });

            select.addEventListener('change', (e) => {
                const val = e.target.value;
                log.status = val;
                if (val === 'Present + OT') {
                    log.otHours = 2;
                    otInput.value = 2;
                } else if (val === 'Absent') {
                    log.checkIn = ""; log.checkOut = ""; log.otHours = 0;
                    otInput.value = 0;
                } else {
                    log.otHours = 0;
                    otInput.value = 0;
                }
                updateDropdownClass(select);
                saveStateToStorage();
                renderWeeklyGrid(); // Recalculate and redraw matrix row values
                
                // Live sync to database
                syncAttendance([buildAttendanceSyncRow(dateStr, emp.id, log)]);
            });

            container.appendChild(select);
            container.appendChild(lateIndicator);
            container.appendChild(otContainer);
            container.appendChild(remarksInput);
            td.appendChild(container);
            tr.appendChild(td);

            // Compute counts
            if (log.status === 'Present') countPresent++;
            else if (log.status === 'Present + OT') { countPresent++; countOT++; }
            else if (log.status === 'Absent') countAbsent++;
            else if (log.status === 'Off Day') countOff++;
            else if (log.status === 'Half Day') countPresent += 0.5;
            else if (log.status === 'Holiday') countPresent++; // Standard paid holiday
        });

        // Compute Estimated Salary
        const salary = (countPresent * emp.rates.present) +
                       (countOT * emp.rates.present_ot) +
                       (countAbsent * emp.rates.absent) +
                       (countOff * emp.rates.off_day);

        // Append summary count cells using DOM API (NOT innerHTML +=, which destroys existing select nodes)
        function makeSummaryCell(text, cls) {
            const td = document.createElement('td');
            td.className = `table-total-count ${cls}`;
            td.textContent = text;
            return td;
        }

        tr.appendChild(makeSummaryCell(countPresent, 'count-present-cell'));
        tr.appendChild(makeSummaryCell(countOT, 'count-ot-cell'));
        tr.appendChild(makeSummaryCell(countAbsent, 'count-absent-cell'));
        tr.appendChild(makeSummaryCell(countOff, 'count-off-cell'));

        const salaryCel = document.createElement('td');
        salaryCel.className = 'table-total-count total-salary-cell';
        salaryCel.textContent = `₹${salary.toLocaleString('en-IN')}`;
        tr.appendChild(salaryCel);

        const slipCel = document.createElement('td');
        slipCel.style.textAlign = 'center';
        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'btn-mini pdf-btn-mini';
        pdfBtn.title = 'Print Slip';
        pdfBtn.innerHTML = '<i class="ph-bold ph-file-pdf"></i><span class="btn-label">PDF</span>';
        pdfBtn.addEventListener('click', () => app.downloadPdfSlip(emp.id));
        slipCel.appendChild(pdfBtn);
        tr.appendChild(slipCel);

        tableBody.appendChild(tr);
    });
}

function renderMonthlyLogSelector() {
    const empSelect = document.getElementById('monthly-log-employee');
    empSelect.innerHTML = "";
    
    const activeEmps = state.employees.filter(e => e.status === 'Active');
    
    activeEmps.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = `${emp.name} (${emp.id})`;
        empSelect.appendChild(opt);
    });

    const monthInput = document.getElementById('monthly-log-month');
    if (!monthInput.value) {
        const today = new Date();
        monthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }

    // Render calendar grid
    renderMonthlyCalendarGrid();

    // Attach listeners
    empSelect.onchange = renderMonthlyCalendarGrid;
    monthInput.onchange = renderMonthlyCalendarGrid;
}

function renderMonthlyCalendarGrid() {
    const empId = document.getElementById('monthly-log-employee').value;
    const monthStr = document.getElementById('monthly-log-month').value;
    const grid = document.getElementById('monthly-calendar-days');
    
    grid.innerHTML = "";
    
    if (!empId || !monthStr) return;

    const dates = getDatesForMonth(monthStr);
    if (dates.length === 0) return;

    // Fill blank cells for day-of-week alignment
    const firstDayIndex = dates[0].getDay(); // 0: Sun, 1: Mon...
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = "calendar-day-box empty-day";
        grid.appendChild(emptyCell);
    }

    dates.forEach(dObj => {
        const dateStr = formatDateYYYYMMDD(dObj);
        const dayLogs = state.attendance[dateStr] || {};
        const log = dayLogs[empId] || { status: 'Present' };
        
        const cell = document.createElement('div');
        cell.className = "calendar-day-box";
        
        // Add modifier class for background
        let modClass = "status-present";
        if (log.status === 'Present + OT') modClass = "status-ot";
        else if (log.status === 'Absent') modClass = "status-absent";
        else if (log.status === 'Off Day') modClass = "status-off";
        else if (log.status === 'Half Day') modClass = "status-half";
        else if (log.status === 'Leave') modClass = "status-leave";
        else if (log.status === 'Holiday') modClass = "status-holiday";

        cell.innerHTML = `
            <span class="day-number">${dObj.getDate()}</span>
            <span class="day-status ${modClass}">${log.status}</span>
        `;
        grid.appendChild(cell);
    });
}

function renderYearlyAttendanceGrid() {
    const empSelect = document.getElementById('yearly-log-employee');
    empSelect.innerHTML = "";
    
    const activeEmps = state.employees.filter(e => e.status === 'Active');
    
    activeEmps.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = `${emp.name} (${emp.id})`;
        empSelect.appendChild(opt);
    });

    const yearInput = document.getElementById('yearly-log-year');
    if (!yearInput.value) {
        yearInput.value = new Date().getFullYear();
    }

    // Render summary stats
    renderYearlySummaryData();

    // Attach listeners
    empSelect.onchange = renderYearlySummaryData;
    yearInput.onchange = renderYearlySummaryData;

    // Attach printer listener if not already bound
    const printBtn = document.getElementById('print-yearly-report-btn');
    if (printBtn) {
        printBtn.onclick = triggerYearlyLogPdfDownload;
    }
}

function renderYearlySummaryData() {
    const empId = document.getElementById('yearly-log-employee').value;
    const year = parseInt(document.getElementById('yearly-log-year').value, 10);
    const tbody = document.getElementById('yearly-summary-table-body');
    
    tbody.innerHTML = "";
    if (!empId || !year) return;

    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;

    const months = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];

    let totalPres = 0;
    let totalOt = 0;
    let totalAbs = 0;
    let totalLve = 0;
    let totalOff = 0;

    months.forEach((mName, mIdx) => {
        const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
        let pres = 0;
        let ot = 0;
        let abs = 0;
        let lve = 0;
        let off = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, mIdx, day);
            const dateStr = formatDateYYYYMMDD(dateObj);
            const dayLogs = state.attendance[dateStr] || {};
            const log = dayLogs[emp.id];
            
            if (log) {
                if (log.status === 'Present') pres++;
                else if (log.status === 'Present + OT') { pres++; ot++; }
                else if (log.status === 'Absent') abs++;
                else if (log.status === 'Off Day') off++;
                else if (log.status === 'Leave') lve++;
                else if (log.status === 'Half Day') pres += 0.5;
                else if (log.status === 'Holiday') pres++;
            }
        }

        const estPay = (pres * emp.rates.present) + 
                       (ot * emp.rates.present_ot) + 
                       (abs * emp.rates.absent) + 
                       (off * emp.rates.off_day);

        totalPres += pres;
        totalOt += ot;
        totalAbs += abs;
        totalLve += lve;
        totalOff += off;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;">${mName}</td>
            <td>${pres}</td>
            <td>${ot}</td>
            <td>${abs}</td>
            <td>${lve}</td>
            <td>${off}</td>
            <td style="font-weight:700; color:var(--primary);">₹${estPay.toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(tr);
    });

    // Update Overview Cards
    document.getElementById('yearly-stat-present').textContent = totalPres;
    document.getElementById('yearly-stat-ot').textContent = totalOt;
    document.getElementById('yearly-stat-absent').textContent = totalAbs;
    document.getElementById('yearly-stat-leaves').textContent = totalLve;
    document.getElementById('yearly-stat-off').textContent = totalOff;
}

function triggerYearlyLogPdfDownload() {
    const empId = document.getElementById('yearly-log-employee').value;
    const year = parseInt(document.getElementById('yearly-log-year').value, 10);
    if (!empId || !year) return;

    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('portrait', 'pt', 'a4');
        const pageW = doc.internal.pageSize.width;
        const pageH = doc.internal.pageSize.height;

        // Double border frame
        doc.setDrawColor(139, 92, 246);
        doc.setLineWidth(1.5);
        doc.rect(20, 20, pageW - 40, pageH - 40);

        // Header Background block
        doc.setFillColor(15, 23, 42);
        doc.rect(25, 25, pageW - 50, 80, 'F');
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text(state.admin.companyName, pageW / 2, 60, { align: "center" });
        doc.setFontSize(11);
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(209, 213, 219);
        doc.text(`ANNUAL ATTENDANCE SHEET & PAYOUT LOG STATEMENT - ${year}`, pageW / 2, 85, { align: "center" });

        doc.setTextColor(15, 23, 42);
        let y = 140;
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.text("EMPLOYEE SUMMARY INFORMATION", 40, y);

        doc.setDrawColor(139, 92, 246);
        doc.setLineWidth(1);
        doc.line(40, y + 6, pageW - 40, y + 6);

        y += 24;
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Employee Name: ${emp.name}`, 40, y);
        doc.text(`Worker ID: ${emp.id}`, 40, y + 18);
        doc.text(`Designation: ${emp.designation || 'N/A'}`, 40, y + 36);

        doc.text(`Calendar Year: ${year}`, pageW / 2 + 20, y);
        doc.text(`Statement Date: ${new Date().toLocaleDateString('en-IN')}`, pageW / 2 + 20, y + 18);

        y += 60;
        const months = [
            "January", "February", "March", "April", "May", "June", 
            "July", "August", "September", "October", "November", "December"
        ];

        const slipHeaders = ["Month", "Present", "OT Sessions", "Absent", "Leave", "Off Days", "Est. Payout"];
        const slipRows = [];
        const payoutAmounts = [];

        let totalPres = 0;
        let totalOt = 0;
        let totalAbs = 0;
        let totalLve = 0;
        let totalOff = 0;
        let totalPayout = 0;

        months.forEach((mName, mIdx) => {
            const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
            let pres = 0;
            let ot = 0;
            let abs = 0;
            let lve = 0;
            let off = 0;

            for (let day = 1; day <= daysInMonth; day++) {
                const dateObj = new Date(year, mIdx, day);
                const dateStr = formatDateYYYYMMDD(dateObj);
                const dayLogs = state.attendance[dateStr] || {};
                const log = dayLogs[emp.id];
                
                if (log) {
                    if (log.status === 'Present') pres++;
                    else if (log.status === 'Present + OT') { pres++; ot++; }
                    else if (log.status === 'Absent') abs++;
                    else if (log.status === 'Off Day') off++;
                    else if (log.status === 'Leave') lve++;
                    else if (log.status === 'Half Day') pres += 0.5;
                    else if (log.status === 'Holiday') pres++;
                }
            }

            const estPay = (pres * emp.rates.present) + 
                           (ot * emp.rates.present_ot) + 
                           (abs * emp.rates.absent) + 
                           (off * emp.rates.off_day);

            totalPres += pres;
            totalOt += ot;
            totalAbs += abs;
            totalLve += lve;
            totalOff += off;
            totalPayout += estPay;
            payoutAmounts.push(estPay);

            slipRows.push([
                mName,
                pres.toString(),
                ot.toString(),
                abs.toString(),
                lve.toString(),
                off.toString(),
                ''
            ]);
        });

        doc.autoTable({
            head: [slipHeaders],
            body: slipRows,
            startY: y,
            theme: 'striped',
            headStyles: { fillColor: [139, 92, 246] },
            margin: { left: 40, right: 40 },
            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === 6) {
                    drawPdfCurrencyAmountInCell(doc, data.cell, payoutAmounts[data.row.index], {
                        fontSize: 9,
                        fontWeight: 500,
                        align: 'right'
                    });
                }
            }
        });

        y = doc.autoTable.previous.finalY + 20;
        
        // Year aggregate block
        doc.setFillColor(249, 250, 251);
        doc.rect(40, y, pageW - 80, 50, 'F');

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(17, 24, 39);
        doc.text(`TOTAL SUMMARY: ${totalPres} Present | ${totalOt} OT | ${totalAbs} Absent | ${totalLve} Leave | ${totalOff} Off`, 50, y + 28);

        // Grand Payout
        doc.setFillColor(139, 92, 246);
        doc.rect(pageW - 220, y, 180, 50, 'F');
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text("EST. YEARLY DISBURSED", pageW - 210, y + 18);
        doc.setFontSize(14);
        drawPdfCurrencyAmount(doc, totalPayout, pageW - 210, y + 38, {
            fontSize: 14,
            fontWeight: 700,
            color: [255, 255, 255],
            maxWidth: 160
        });

        y += 80;
        doc.setDrawColor(156, 163, 175);
        doc.line(60, y, 200, y);
        doc.line(pageW - 200, y, pageW - 60, y);
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(17, 24, 39);
        doc.text("Authorized Admin Signature", 60, y + 16);
        doc.text("Worker Signature", pageW - 200, y + 16);

        doc.save(`Yearly_Attendance_${emp.name}_${year}.pdf`);
        logActivity("Print Yearly Report", `Downloaded yearly summary log PDF for ${emp.name} (${year})`);
        showToast("Yearly report downloaded successfully.");
    } catch (e) {
        console.error("Yearly report PDF crash:", e);
        alert("Failed to export PDF.");
    }
}

function renderHolidaysDesk() {
    const listBody = document.getElementById('holidays-list-table-body');
    listBody.innerHTML = "";
    
    const dates = Object.keys(state.holidays).sort();
    
    if (dates.length === 0) {
        listBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No holidays scheduled.</td></tr>`;
        return;
    }

    dates.forEach(dStr => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700;">${dStr}</td>
            <td>${escapeHTML(state.holidays[dStr])}</td>
            <td>
                <button class="btn-mini hard-delete-btn-mini" onclick="app.removeHoliday('${dStr}')" title="Delete Holiday">
                    <i class="ph ph-trash"></i>
                    <span class="btn-label">Delete</span>
                </button>
            </td>
        `;
        listBody.appendChild(tr);
    });
}

function setupHolidayControls() {
    document.getElementById('add-holiday-btn').addEventListener('click', () => {
        const dStr = prompt("Enter Holiday Date (YYYY-MM-DD):", formatDateYYYYMMDD(new Date()));
        if (!dStr) return;
        const occasion = prompt("Enter Holiday Occasion Title:");
        if (!occasion) return;
        
        state.holidays[dStr] = occasion;
        logActivity("Add Holiday", `Declared company holiday on ${dStr}: ${occasion}`);
        showToast("Holiday added to calendar.");
        syncHoliday(dStr, occasion);
        saveStateToStorage();
        renderHolidaysDesk();
    });

    // Special leaves form
    document.getElementById('bulk-special-leave-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const date = document.getElementById('bulk-leave-date').value;
        const status = document.getElementById('bulk-leave-status').value;
        const remarks = document.getElementById('bulk-leave-remarks').value;

        if (!state.attendance[date]) state.attendance[date] = {};
        
        state.employees.forEach(emp => {
            if (emp.status === 'Active') {
                state.attendance[date][emp.id] = {
                    status: status,
                    checkIn: "",
                    checkOut: "",
                    otHours: 0,
                    late: false,
                    remarks: remarks,
                    shift: document.getElementById('weekly-shift-select')?.value || 'General',
                    isLocked: false,
                    isApproved: true
                };
            }
        });

        const syncRows = Object.keys(state.attendance[date] || {}).map(empId => ({
            ...buildAttendanceSyncRow(date, empId, state.attendance[date][empId])
        }));

        logActivity("Bulk Holiday/Leave", `Applied bulk ${status} status for date ${date}`);
        showToast(`Bulk marked all employees as ${status}.`);
        syncAttendance(syncRows);
        saveStateToStorage();
        document.getElementById('bulk-special-leave-form').reset();
    });
}

function removeHoliday(dateStr) {
    if (confirm(`Remove scheduled holiday on ${dateStr}?`)) {
        delete state.holidays[dateStr];
        logActivity("Remove Holiday", `Deleted company holiday on ${dateStr}`);
        showToast("Holiday removed.");
        syncHoliday(dateStr, '', true);
        saveStateToStorage();
        renderHolidaysDesk();
    }
}

// ----------------------------------------------------
// Financial Payroll Hub & Ledger Engine
// ----------------------------------------------------
let activePayrollCalculation = {};

function setupPayrollCalculatorTab() {
    const select = document.getElementById('payroll-employee-select');
    select.innerHTML = "";
    
    const activeEmps = state.employees.filter(e => e.status === 'Active');
    
    activeEmps.forEach(emp => {
        const o = document.createElement('option');
        o.value = emp.id;
        o.textContent = `${emp.name} (${emp.id})`;
        select.appendChild(o);
    });

    select.onchange = runSalaryBreakdownArithmetic;

    const weeklyToggle = document.getElementById('toggle-payroll-weekly');
    const monthlyToggle = document.getElementById('toggle-payroll-monthly');
    const monthPicker = document.getElementById('payroll-month-picker');
    const monthInput = document.getElementById('payroll-month-select');
    const setPayrollPeriod = (period) => {
        weeklyToggle.classList.toggle('active', period === 'weekly');
        monthlyToggle.classList.toggle('active', period === 'monthly');
        monthPicker.style.display = period === 'monthly' ? 'block' : 'none';
        runSalaryBreakdownArithmetic();
    };
    weeklyToggle.onclick = () => setPayrollPeriod('weekly');
    monthlyToggle.onclick = () => setPayrollPeriod('monthly');
    monthInput.onchange = runSalaryBreakdownArithmetic;
    
    document.getElementById('payroll-preview-btn').onclick = runSalaryBreakdownArithmetic;
    document.getElementById('payroll-commit-btn').onclick = commitSalaryToHistoryLedger;
    document.getElementById('calc-download-pdf-btn').onclick = triggerSingleSlipPdfDownload;

    // Initial arithmetic
    runSalaryBreakdownArithmetic();
}

function getMonthDates(yr, mon) {
    const date = new Date(yr, mon - 1, 1);
    const dates = [];
    while (date.getMonth() === mon - 1) {
        dates.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return dates;
}

function runSalaryBreakdownArithmetic() {
    const period = document.querySelector('#payroll-period-toggle .toggle-btn.active').dataset.period;
    const empId = document.getElementById('payroll-employee-select').value;
    if (!empId) {
        document.getElementById('payslip-preview-container').innerHTML = `<div class="empty-list-notice">No active workers to calculate.</div>`;
        return;
    }
    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;
    let dates = [];
    if (period === 'weekly') {
        dates = getWeekDatesRange(state.currentWeek, state.dayRange);
    } else { // monthly
        const monthVal = document.getElementById('payroll-month-select').value;
        if (!monthVal) {
            const today = new Date();
            document.getElementById('payroll-month-select').value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
        }
        const [yr, mon] = document.getElementById('payroll-month-select').value.split('-').map(Number);
        dates = getMonthDates(yr, mon);
    }

    let countPresent = 0;
    let countOT = 0;
    let countAbsent = 0;
    let countOff = 0;
    let otHoursSum = 0;

    dates.forEach(dObj => {
        const dStr = formatDateYYYYMMDD(dObj);
        const log = (state.attendance[dStr] && state.attendance[dStr][emp.id]) || { status: 'Present', otHours: 0 };
        
        if (log.status === 'Present') countPresent++;
        else if (log.status === 'Present + OT') {
            countPresent++;
            countOT++;
            otHoursSum += (log.otHours || 0);
        } else if (log.status === 'Absent') countAbsent++;
        else if (log.status === 'Off Day') countOff++;
        else if (log.status === 'Half Day') countPresent += 0.5;
        else if (log.status === 'Holiday') countPresent++;
    });

    // Formulations
    const basePayout = countPresent * emp.rates.present;
    // Calculate OT pay (if ot rate is defined, e.g. Sathya 400 is flat per OT day. For hours basis, we map present_ot / 8)
    const otPayout = countOT * emp.rates.present_ot;
    const offPayout = countOff * emp.rates.off_day;

    // Load inputs adjustments
    const bonus = parseFloat(document.getElementById('calc-incentive').value) || 0;
    const advance = parseFloat(document.getElementById('calc-deduct-advance').value) || 0;
    const loan = parseFloat(document.getElementById('calc-deduct-loan').value) || 0;
    const fine = parseFloat(document.getElementById('calc-deduct-fine').value) || 0;

    const grossSalary = basePayout + otPayout + offPayout + bonus;
    const totalDeductions = advance + loan + fine;
    const netSalary = grossSalary - totalDeductions;

    // Save temporary details globally for PDF trigger
    activePayrollCalculation = {
        emp, countPresent, countOT, countAbsent, countOff, basePayout, otPayout, offPayout,
        bonus, advance, loan, fine, grossSalary, totalDeductions, netSalary
    };

    // Update form readonly text inputs
    document.getElementById('calc-days-present').value = countPresent;
    document.getElementById('calc-payout-base').value = basePayout;
    
    document.getElementById('calc-days-ot').value = countOT;
    document.getElementById('calc-payout-ot').value = otPayout;
    
    document.getElementById('calc-days-off').value = countOff;
    document.getElementById('calc-payout-off').value = offPayout;

    // Draw Slip visual HTML mockup inside container
    const preview = document.getElementById('payslip-preview-container');
    const logoHtml = state.admin.companyLogo ? `<img src="${state.admin.companyLogo}" style="max-height:48px; border-radius:4px; margin-bottom:8px;">` : '';
    
    preview.innerHTML = `
        <div class="payslip-header">
            ${logoHtml}
            <h4>${escapeHTML(state.admin.companyName)}</h4>
            <p>${escapeHTML(state.admin.companyAddress)} | Phone: ${escapeHTML(state.admin.companyPhone)}</p>
            <p style="font-weight:700; color:var(--primary); margin-top:5px;">PAY SLIP & EARNINGS LOG STATEMENT</p>
        </div>
        
        <div class="payslip-details-grid">
            <div class="payslip-details-row"><span class="label">Name:</span> <span class="value">${escapeHTML(emp.name)}</span></div>
            <div class="payslip-details-row"><span class="label">Week:</span> <span class="value">${state.currentWeek}</span></div>
            <div class="payslip-details-row"><span class="label">ID:</span> <span class="value">${emp.id}</span></div>
            <div class="payslip-details-row"><span class="label">Dates:</span> <span class="value" style="font-size:9.5px;">${formatDatesRangeText(dates)}</span></div>
        </div>

        <table class="payslip-table">
            <thead>
                <tr>
                    <th>Salary Component Breakdown</th>
                    <th style="text-align:right;">Amount (₹)</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>Base Present Earnings (${countPresent} days)</td><td class="amount">₹${basePayout}</td></tr>
                <tr><td>Overtime Payout (${countOT} days)</td><td class="amount">₹${otPayout}</td></tr>
                <tr><td>Scheduled Off Payout (${countOff} days)</td><td class="amount">₹${offPayout}</td></tr>
                <tr><td>Bonus / Extra Incentives</td><td class="amount" style="color:var(--success);">+ ₹${bonus}</td></tr>
                <tr><td>Salary Advance Deduction</td><td class="amount" style="color:var(--danger);">- ₹${advance}</td></tr>
                <tr><td>Loan Installment Repay</td><td class="amount" style="color:var(--danger);">- ₹${loan}</td></tr>
                <tr><td>Attendance Fines / Penalties</td><td class="amount" style="color:var(--danger);">- ₹${fine}</td></tr>
            </tbody>
        </table>

        <div class="payslip-net-box">
            <span>NET WEEKLY NET PAYOUT</span>
            <span>₹${netSalary.toLocaleString('en-IN')}</span>
        </div>
    `;
}

function commitSalaryToHistoryLedger() {
    if (!activePayrollCalculation.emp) return;
    
    const period = document.querySelector('#payroll-period-toggle .toggle-btn.active').dataset.period;
    const periodId = period === 'weekly' ? state.currentWeek : document.getElementById('payroll-month-select').value;
    
    const txId = `TX-${Date.now()}`;
    const data = {
        txId,
        empId: activePayrollCalculation.emp.id,
        empName: activePayrollCalculation.emp.name,
        week: periodId,
        periodType: period,
        basePay: activePayrollCalculation.basePayout,
        bonus: activePayrollCalculation.bonus,
        incentive: activePayrollCalculation.bonus,
        deductAdvance: activePayrollCalculation.advance,
        deductLoan: activePayrollCalculation.loan,
        deductFine: activePayrollCalculation.fine,
        incentives: activePayrollCalculation.bonus,
        deductions: activePayrollCalculation.totalDeductions,
        netSalary: activePayrollCalculation.netSalary,
        approvalStatus: 'Approved',
        approvedBy: 'Admin',
        payDate: formatDateYYYYMMDD(new Date())
    };

    if (!state.payrollLedger[periodId]) {
        state.payrollLedger[periodId] = {};
    }

    state.payrollLedger[periodId][data.empId] = data;
    
    // Sync to database
    syncPayroll(data);
    
    logActivity("Save Payroll Slip", `Approved & saved ${period} payslip for ${data.empName} (${data.empId})`);
    showToast("Payroll voucher saved into ledger successfully.");
    saveStateToStorage();
    renderPayrollHistoryLedger();
}

function renderPayrollHistoryLedger() {
    const body = document.getElementById('payroll-history-table-body');
    body.innerHTML = "";
    
    let logsCount = 0;
    
    for (const week in state.payrollLedger) {
        const weekEntries = state.payrollLedger[week];
        for (const empId in weekEntries) {
            const tx = weekEntries[empId];
            logsCount++;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${tx.txId}</strong></td>
                <td>${escapeHTML(tx.empName)}</td>
                <td>${tx.week}</td>
                <td>₹${tx.basePayout}</td>
                <td>₹${tx.bonus}</td>
                <td>₹${tx.deductions}</td>
                <td style="color:var(--primary); font-weight:800;">₹${tx.netSalary.toLocaleString('en-IN')}</td>
                <td>${tx.payDate}</td>
                <td>
                    <button class="btn-mini pdf-btn-mini" onclick="app.downloadPdfSlip('${tx.empId}')" title="Print Slip PDF">
                        <i class="ph-bold ph-printer"></i>
                        <span class="btn-label">PDF</span>
                    </button>
                </td>
            `;
            body.appendChild(tr);
        }
    }

    if (logsCount === 0) {
        body.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No payroll transaction history logs saved yet.</td></tr>`;
    }
}

function triggerSingleSlipPdfDownload() {
    if (!activePayrollCalculation.emp) return;
    const calc = activePayrollCalculation;
    exportIndividualPDF(calc.emp, calc.countPresent, calc.countOT, calc.countAbsent, calc.countOff, calc.netSalary);
}

// ----------------------------------------------------
// Reports & Exports Suite
// ----------------------------------------------------
function renderReportsPanel() {
    // Set reports date defaults to current
    document.getElementById('report-week-select').value = state.currentWeek;
    
    const today = new Date();
    document.getElementById('report-month-select').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('report-year-select').value = today.getFullYear();

    // Period switcher toggles input visibility
    const typeSelect = document.getElementById('report-period-type');
    const weekGrp = document.getElementById('report-week-group');
    const monthGrp = document.getElementById('report-month-group');
    const yearGrp = document.getElementById('report-year-group');

    typeSelect.onchange = () => {
        if (typeSelect.value === 'weekly') {
            weekGrp.style.display = 'block';
            monthGrp.style.display = 'none';
            yearGrp.style.display = 'none';
        } else if (typeSelect.value === 'monthly') {
            weekGrp.style.display = 'none';
            monthGrp.style.display = 'block';
            yearGrp.style.display = 'none';
        } else {
            weekGrp.style.display = 'none';
            monthGrp.style.display = 'none';
            yearGrp.style.display = 'block';
        }
        renderDetailedReportTable();
    };

    // Bind filters once per render without stacking duplicate listeners.
    document.getElementById('report-week-select').onchange = renderDetailedReportTable;
    document.getElementById('report-month-select').onchange = renderDetailedReportTable;
    document.getElementById('report-year-select').onchange = renderDetailedReportTable;
    document.getElementById('report-department-select').onchange = renderDetailedReportTable;
    document.getElementById('report-category-select').onchange = renderDetailedReportTable;
    document.getElementById('report-search').oninput = renderDetailedReportTable;
    document.getElementById('refresh-report-btn').onclick = renderDetailedReportTable;

    // Draw static cost/attendance summaries
    calculateSystemCostMetrics();
    
    // Render detailed report table
    renderDetailedReportTable();
}

function calculateSystemCostMetrics() {
    const activeEmps = state.employees.filter(e => e.status === 'Active');
    document.getElementById('metric-active-employees').textContent = activeEmps.length;
    
    // Average attendance for current week
    const dates = getWeekDatesRange(state.currentWeek, state.dayRange);
    let presentSum = 0;
    let otSum = 0;
    let totalLate = 0;
    let totalAbsent = 0;
    
    dates.forEach(d => {
        const dStr = formatDateYYYYMMDD(d);
        const logs = state.attendance[dStr] || {};
        for (const empId in logs) {
            const log = logs[empId];
            const logStatus = log.status;
            if (logStatus === 'Present') presentSum++;
            else if (logStatus === 'Present + OT') { presentSum++; otSum++; }
            else if (logStatus === 'Half Day') presentSum += 0.5;
            else if (logStatus === 'Holiday') presentSum++;
            else if (logStatus === 'Absent') totalAbsent++;
            
            if (log.late) totalLate++;
        }
    });

    const maxDays = dates.length * activeEmps.length;
    const avgAttendance = maxDays > 0 ? (presentSum / maxDays) * 100 : 0;
    document.getElementById('metric-avg-attendance').textContent = `${avgAttendance.toFixed(1)}%`;
    document.getElementById('metric-total-ot-hours').textContent = `${otSum * 2} hrs`; // Estimated 2 hrs OT per OT marked day
    document.getElementById('metric-total-late').textContent = totalLate;
    document.getElementById('metric-total-absent').textContent = totalAbsent;

    // Total net disbursed ever in payrollLedger
    let disbursedSum = 0;
    for (const week in state.payrollLedger) {
        for (const empId in state.payrollLedger[week]) {
            disbursedSum += (state.payrollLedger[week][empId].netSalary || 0);
        }
    }
    document.getElementById('metric-total-disbursed').textContent = `₹${disbursedSum.toLocaleString('en-IN')}`;
}

function renderDetailedReportTable() {
    const tbody = document.getElementById('report-detailed-table-body');
    tbody.innerHTML = '';
    
    const periodType = document.getElementById('report-period-type').value;
    const departmentFilter = document.getElementById('report-department-select').value;
    const categoryFilter = document.getElementById('report-category-select').value;
    const searchTerm = document.getElementById('report-search').value.toLowerCase();
    
    let dates = [];
    if (periodType === 'weekly') {
        dates = getWeekDatesRange(state.currentWeek, state.dayRange);
    } else if (periodType === 'monthly') {
        const monthVal = document.getElementById('report-month-select').value;
        const [yr, mon] = monthVal.split('-').map(Number);
        dates = getMonthDates(yr, mon);
    } else {
        const year = parseInt(document.getElementById('report-year-select').value);
        for (let m = 1; m <= 12; m++) {
            dates = dates.concat(getMonthDates(year, m));
        }
    }
    
    const filteredEmps = state.employees.filter(emp => {
        if (emp.status !== 'Active') return false;
        if (departmentFilter !== 'All' && emp.department !== departmentFilter) return false;
        if (categoryFilter !== 'All' && emp.category !== categoryFilter) return false;
        if (searchTerm && !emp.name.toLowerCase().includes(searchTerm) && !emp.id.toLowerCase().includes(searchTerm)) return false;
        return true;
    });
    
    filteredEmps.forEach(emp => {
        let countPresent = 0;
        let countOT = 0;
        let countAbsent = 0;
        let countOff = 0;
        let totalLate = 0;
        
        dates.forEach(dObj => {
            const dStr = formatDateYYYYMMDD(dObj);
            const log = (state.attendance[dStr] && state.attendance[dStr][emp.id]) || { status: 'Present', late: false };
            
            if (log.status === 'Present') countPresent++;
            else if (log.status === 'Present + OT') { countPresent++; countOT++; }
            else if (log.status === 'Absent') countAbsent++;
            else if (log.status === 'Off Day') countOff++;
            else if (log.status === 'Half Day') countPresent += 0.5;
            else if (log.status === 'Holiday') countPresent++;
            
            if (log.late) totalLate++;
        });
        
        const basePay = countPresent * emp.rates.present;
        const otPay = countOT * emp.rates.present_ot;
        const offPay = countOff * emp.rates.off_day;
        const grossSalary = basePay + otPay + offPay;
        
        // Get deductions from payroll ledger if available
        let deductions = 0;
        const periodId = periodType === 'weekly' ? state.currentWeek : 
                         periodType === 'monthly' ? document.getElementById('report-month-select').value :
                         document.getElementById('report-year-select').value;
        
        if (state.payrollLedger[periodId] && state.payrollLedger[periodId][emp.id]) {
            deductions = state.payrollLedger[periodId][emp.id].deductions || 0;
        }
        
        const netSalary = grossSalary - deductions;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${emp.id}</strong></td>
            <td>${escapeHTML(emp.name)}</td>
            <td>${escapeHTML(emp.department)}</td>
            <td><span style="padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: ${emp.category === 'Permanent' ? 'var(--success-bg)' : emp.category === 'Temporary' ? 'var(--warning-bg)' : 'var(--info-bg)'}; color: ${emp.category === 'Permanent' ? 'var(--success)' : emp.category === 'Temporary' ? 'var(--warning)' : 'var(--info)'};">${emp.category}</span></td>
            <td style="text-align: center; font-weight: 700; color: var(--success);">${countPresent}</td>
            <td style="text-align: center; font-weight: 700; color: var(--status-present-ot);">${countOT}</td>
            <td style="text-align: center; font-weight: 700; color: var(--danger);">${countAbsent}</td>
            <td style="text-align: center; font-weight: 700; color: var(--status-off);">${countOff}</td>
            <td style="text-align: center; font-weight: 700; color: var(--warning);">${totalLate}</td>
            <td style="text-align: right;">₹${basePay.toLocaleString('en-IN')}</td>
            <td style="text-align: right;">₹${otPay.toLocaleString('en-IN')}</td>
            <td style="text-align: right; color: var(--danger);">- ₹${deductions.toLocaleString('en-IN')}</td>
            <td style="text-align: right; font-weight: 800; color: var(--primary);">₹${netSalary.toLocaleString('en-IN')}</td>
            <td style="text-align: center;">
                <button class="btn-mini pdf-btn-mini" onclick="app.downloadPdfSlip('${emp.id}')" title="Download PDF">
                    <i class="ph-bold ph-file-pdf"></i>
                    <span class="btn-label">PDF</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    if (filteredEmps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="14" style="text-align: center; color: var(--text-muted); padding: 40px;">No employees match the current filters.</td></tr>`;
    }
}

function setupReportExportButtons() {
    // Reports panel buttons
    document.getElementById('btn-report-excel').addEventListener('click', triggerExcelExportReport);
    document.getElementById('btn-report-csv').addEventListener('click', triggerCsvExportReport);
    document.getElementById('btn-report-bulk-pdf').addEventListener('click', compileBulkSlipsPdfDocument);

    // Attendance desk weekly matrix exports
    const attExcel = document.getElementById('export-excel-btn');
    if (attExcel) attExcel.addEventListener('click', exportToExcel);

    const attPdf = document.getElementById('export-pdf-btn');
    if (attPdf) attPdf.addEventListener('click', compileBulkSlipsPdfDocument);
}

function triggerExcelExportReport() {
    // Legacy Excel downloader
    exportToExcel();
}

function triggerCsvExportReport() {
    if (state.employees.length === 0) {
        alert('No data to export.');
        return;
    }
    try {
        const dates = getWeekDatesRange(state.currentWeek, state.dayRange);
        const activeDays = DAYS_SHORT.slice(0, state.dayRange);
        const weekRecords = state.attendance[state.currentWeek] || {};
        
        let csv = "Employee ID,Employee Name,Mon,Tue,Wed,Thu,Fri,Sat,Sun,Net Payout\r\n";
        
        state.employees.forEach(emp => {
            let row = `${emp.id},${emp.name}`;
            let countPresent = 0;
            let countOT = 0;
            let countAbsent = 0;
            let countOff = 0;

            activeDays.forEach(day => {
                const dateStr = formatDateYYYYMMDD(dates[activeDays.indexOf(day)]);
                const status = (state.attendance[dateStr] && state.attendance[dateStr][emp.id] && state.attendance[dateStr][emp.id].status) || 'Present';
                row += `,${status}`;
                
                if (status === 'Present') countPresent++;
                else if (status === 'Present + OT') { countPresent++; countOT++; }
                else if (status === 'Absent') countAbsent++;
                else if (status === 'Off Day') countOff++;
                else if (status === 'Half Day') countPresent += 0.5;
            });
            // Fill blanks if Mon-Sat selected
            if (activeDays.length === 6) row += `,`;

            const salary = (countPresent * emp.rates.present) + 
                           (countOT * emp.rates.present_ot) + 
                           (countAbsent * emp.rates.absent) + 
                           (countOff * emp.rates.off_day);

            row += `,${salary}\r\n`;
            csv += row;
        });

        // Trigger browser download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `Payroll_Sheet_${state.currentWeek}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error(e);
        alert("Error exporting CSV.");
    }
}

function compileBulkSlipsPdfDocument() {
    const activeEmps = state.employees.filter(e => e.status === 'Active');
    if (activeEmps.length === 0) {
        alert("No active employees to generate bulk PDF statement.");
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('portrait', 'pt', 'a4');
        const pageW = doc.internal.pageSize.width;
        const pageH = doc.internal.pageSize.height;
        const dates = getWeekDatesRange(state.currentWeek, state.dayRange);
        const dateStr = formatDatesRangeText(dates);

        activeEmps.forEach((emp, empIdx) => {
            if (empIdx > 0) doc.addPage();
            
            // Re-run simple count loops for this employee
            let countPresent = 0;
            let countOT = 0;
            let countAbsent = 0;
            let countOff = 0;

            dates.forEach(dObj => {
                const dStr = formatDateYYYYMMDD(dObj);
                const s = (state.attendance[dStr] && state.attendance[dStr][emp.id] && state.attendance[dStr][emp.id].status) || 'Present';
                if (s === 'Present') countPresent++;
                else if (s === 'Present + OT') { countPresent++; countOT++; }
                else if (s === 'Absent') countAbsent++;
                else if (s === 'Off Day') countOff++;
                else if (s === 'Half Day') countPresent += 0.5;
            });

            const salary = (countPresent * emp.rates.present) + 
                           (countOT * emp.rates.present_ot) + 
                           (countAbsent * emp.rates.absent) + 
                           (countOff * emp.rates.off_day);

            // Double border frame
            doc.setDrawColor(139, 92, 246);
            doc.setLineWidth(1.5);
            doc.rect(20, 20, pageW - 40, pageH - 40);

            // Header Background block
            doc.setFillColor(15, 23, 42);
            doc.rect(25, 25, pageW - 50, 80, 'F');
            
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.text(state.admin.companyName, pageW / 2, 60, { align: "center" });
            doc.setFontSize(11);
            doc.setFont("Helvetica", "normal");
            doc.setTextColor(209, 213, 219);
            doc.text("WEEKLY SALARY SLIP & ATTENDANCE STATEMENT", pageW / 2, 85, { align: "center" });

            doc.setTextColor(15, 23, 42);
            let y = 140;
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(11);
            doc.text("EMPLOYEE INFORMATION", 40, y);
            doc.text("PAYMENT DETAILS", pageW / 2 + 20, y);

            doc.setDrawColor(139, 92, 246);
            doc.setLineWidth(1);
            doc.line(40, y + 6, pageW - 40, y + 6);

            y += 24;
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(10);
            doc.text(`Employee Name: ${emp.name}`, 40, y);
            doc.text(`Worker ID: ${emp.id}`, 40, y + 18);
            doc.text(`Designation: ${emp.designation || 'N/A'}`, 40, y + 36);

            doc.text(`Statement Week: ${state.currentWeek}`, pageW / 2 + 20, y);
            doc.text(`Date Range: ${dateStr}`, pageW / 2 + 20, y + 18);
            doc.text(`Pay Slip Date: ${new Date().toLocaleDateString('en-IN')}`, pageW / 2 + 20, y + 36);

            // Draw clean table of days
            y += 70;
            const slipHeaders = ["Day Name", "Calendar Date", "Attendance Status"];
            const slipRows = [];
            dates.forEach((dObj, idx) => {
                const s = (state.attendance[formatDateYYYYMMDD(dObj)] && state.attendance[formatDateYYYYMMDD(dObj)][emp.id] && state.attendance[formatDateYYYYMMDD(dObj)][emp.id].status) || 'Present';
                slipRows.push([DAYS_FULL[idx], dObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), s]);
            });

            doc.autoTable({
                head: [slipHeaders],
                body: slipRows,
                startY: y,
                theme: 'striped',
                headStyles: { fillColor: [139, 92, 246] },
                margin: { left: 40, right: 40 }
            });

            y = doc.autoTable.previous.finalY + 30;
            doc.setFillColor(249, 250, 251);
            doc.rect(40, y, pageW - 80, 60, 'F');

            doc.setFont("Helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(107, 114, 128);
            doc.text("Present / OT / Absent / Off Days", 50, y + 20);
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(17, 24, 39);
            doc.text(`${countPresent} PR  |  ${countOT} OT  |  ${countAbsent} AB  |  ${countOff} OFF`, 50, y + 42);

            // Large highlighted salary box
            doc.setFillColor(139, 92, 246);
            doc.rect(pageW - 220, y, 180, 60, 'F');
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);
            doc.text("NET SALARY", pageW - 200, y + 20);
            doc.setFontSize(16);
            drawPdfCurrencyAmount(doc, salary, pageW - 200, y + 42, {
                fontSize: 16,
                fontWeight: 700,
                color: [255, 255, 255],
                maxWidth: 160
            });

            // Signatures layout
            y += 110;
            doc.setDrawColor(156, 163, 175);
            doc.line(60, y, 200, y);
            doc.line(pageW - 200, y, pageW - 60, y);
            
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(17, 24, 39);
            doc.text("Authorized Admin Signature", 60, y + 16);
            doc.text("Worker Signature", pageW - 200, y + 16);
        });

        doc.save(`Bulk_Payroll_Vouchers_${state.currentWeek}.pdf`);
        logActivity("Bulk PDF Compiling", `Generated combined salary slips PDF for ${activeEmps.length} employees.`);
        showToast("Bulk PDFs generated successfully.");
    } catch (e) {
        console.error(e);
        alert("Failed to build combined PDF document.");
    }
}

// ----------------------------------------------------
// Admin Configuration System & Database Tools
// ----------------------------------------------------
function loadSettingsFormValues() {
    document.getElementById('settings-company-name').value = state.admin.companyName;
    document.getElementById('settings-company-address').value = state.admin.companyAddress;
    document.getElementById('settings-company-phone').value = state.admin.companyPhone;
    
    const logoPreview = document.getElementById('logo-preview-image');
    if (state.admin.companyLogo) {
        logoPreview.src = state.admin.companyLogo;
        logoPreview.style.display = 'block';
    } else {
        logoPreview.style.display = 'none';
    }

    // Toggle password status checkbox
    const pToggle = document.getElementById('settings-gate-toggle');
    pToggle.checked = state.admin.loginEnabled;

    // Load active color indicator dot
    document.querySelectorAll('.theme-picker-grid .theme-dot').forEach(dot => {
        dot.classList.remove('active');
        if (dot.getAttribute('data-color') === state.colorTheme) {
            dot.classList.add('active');
        }
    });

    // Theme mode text status
    const btnL = document.getElementById('btn-theme-light');
    const btnD = document.getElementById('btn-theme-dark');
    if (state.theme === 'dark') {
        btnD.classList.add('active'); btnL.classList.remove('active');
    } else {
        btnL.classList.add('active'); btnD.classList.remove('active');
    }
}

function setupSettingsListeners() {
    const companyForm = document.getElementById('settings-company-form');
    const passwordForm = document.getElementById('settings-password-form');
    
    // Company logo reader
    document.getElementById('settings-company-logo').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('logo-preview-image').src = ev.target.result;
                document.getElementById('logo-preview-image').style.display = 'block';
                state.admin.companyLogo = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    
    companyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        state.admin.companyName = document.getElementById('settings-company-name').value;
        state.admin.companyAddress = document.getElementById('settings-company-address').value;
        state.admin.companyPhone = document.getElementById('settings-company-phone').value;
        saveStateToStorage();
        syncSettings();
        showToast("Company profile updated successfully.");
    });
    
    passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        state.admin.password = document.getElementById('settings-admin-pass').value;
        state.admin.loginEnabled = document.getElementById('settings-gate-toggle').checked;
        ensureStateDefaults();
        const primaryAdmin = state.adminUsers.find(user => String(user.username || '').toLowerCase() === 'admin');
        if (primaryAdmin) primaryAdmin.password = state.admin.password;
        saveStateToStorage();
        syncSettings();
        showToast("Security settings saved successfully.");
    });
    
    // Theme toggles
    const btnL = document.getElementById('btn-theme-light');
    const btnD = document.getElementById('btn-theme-dark');
    
    btnL.addEventListener('click', () => {
        state.theme = 'light';
        document.body.classList.remove('dark-theme');
        btnL.classList.add('active'); btnD.classList.remove('active');
        saveStateToStorage();
        syncSettings();
    });
    
    btnD.addEventListener('click', () => {
        state.theme = 'dark';
        document.body.classList.add('dark-theme');
        btnD.classList.add('active'); btnL.classList.remove('active');
        saveStateToStorage();
        syncSettings();
    });

    // Accent Dot pickers
    document.querySelectorAll('.theme-picker-grid .theme-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const color = dot.getAttribute('data-color');
            state.colorTheme = color;
            
            // Remove previous accent classes from body
            document.body.classList.remove('color-indigo', 'color-gold', 'color-emerald', 'color-slate');
            document.body.classList.add(`color-${color}`);
            
            document.querySelectorAll('.theme-picker-grid .theme-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            
            saveStateToStorage();
            syncSettings();
            showToast(`Applied ${color} accent theme.`);
        });
    });

    // Database Tools: Backup Download
    document.getElementById('btn-db-backup').addEventListener('click', async () => {
        if (CLOUD_REQUIRED && !isOnline) {
            handleOfflineWrite('Database backup');
            return;
        }

        let backupPayload = {
            backupType: 'offline_state',
            exportedAt: new Date().toISOString(),
            state
        };

        if (isOnline) {
            try {
                const serverBackup = await postJsonAction('backup_db');
                backupPayload = {
                    backupType: 'mysql_tables',
                    exportedAt: new Date().toISOString(),
                    companyName: state.admin.companyName,
                    tables: serverBackup.data
                };
            } catch (e) {
                console.error("Server backup failed, using offline state backup:", e);
                if (CLOUD_REQUIRED) {
                    alert(`Cloud backup failed: ${e.message}`);
                    return;
                }
            }
        }

        const fileContent = JSON.stringify(backupPayload, null, 2);
        const blob = new Blob([fileContent], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `${sanitizeFilePart(state.admin.companyName)}_database_backup_${formatDateYYYYMMDD(new Date())}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        logActivity("Backup Database", "Exported JSON system database backup");
        showToast("Database file downloaded.");
    });

    // Database Tools: Import Restore File
    document.getElementById('btn-db-restore-submit').addEventListener('click', () => {
        if (CLOUD_REQUIRED && !isOnline) {
            handleOfflineWrite('Database restore');
            return;
        }
        const fileInput = document.getElementById('btn-db-restore-file');
        const file = fileInput.files[0];
        if (!file) {
            alert("Please select a valid `.json` backup file first!");
            return;
        }
        if (confirm("Restore Database: This will replace all current datasets. Do you wish to continue?")) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const backup = JSON.parse(e.target.result);
                    const restoreTables = backup.backupType === 'mysql_tables' ? backup.tables : backup;
                    const restoreState = backup.backupType === 'offline_state' ? backup.state : backup;

                    if (isOnline && restoreTables && restoreTables.employees && restoreTables.attendance) {
                        postJsonAction('restore_db', restoreTables)
                            .then(() => refreshStateFromServer({ silent: false }))
                            .then(() => {
                                logActivity("Restore Database", "Restored central MySQL database from backup file");
                                showToast("Online database restored successfully!");
                                setTimeout(() => window.location.reload(), 1000);
                            })
                            .catch(err => alert(`Online restore failed: ${err.message}`));
                    } else if (restoreState && restoreState.employees && restoreState.attendance) {
                        if (CLOUD_REQUIRED && !isOnline) {
                            alert("Cloud database is not connected. Restore was not applied to localStorage.");
                            return;
                        }
                        state = { ...state, ...restoreState };
                        ensureStateDefaults();
                        saveStateToStorage();
                        if (isOnline) syncFullStateToServer();
                        logActivity("Restore Database", "Uploaded and restored database from JSON file");
                        showToast("System database restored successfully!");
                        setTimeout(() => window.location.reload(), 1000);
                    } else {
                        alert("Invalid backup file structure!");
                    }
                } catch (err) {
                    alert("Failed to parse JSON file.");
                }
            };
            reader.readAsText(file);
        }
    });

    // Factory Database Reset
    document.getElementById('btn-db-reset').addEventListener('click', () => {
        if (confirm("DANGER CRITICAL RESET: Are you sure you want to completely erase the portal database? This action is irreversible.")) {
            if (isOnline) {
                postJsonAction('reset_database')
                    .then(() => {
                        localStorage.clear();
                        showToast("Online database reset. Reloading...", true);
                        setTimeout(() => window.location.reload(), 1000);
                    })
                    .catch(err => alert(`Online reset failed: ${err.message}`));
            } else {
                if (CLOUD_REQUIRED) {
                    handleOfflineWrite('Database reset');
                    return;
                }
                localStorage.clear();
                showToast("Offline cache reset. Reloading...", true);
                setTimeout(() => window.location.reload(), 1000);
            }
        }
    });

    // Announcements trigger posting
    document.getElementById('open-announcement-modal-btn').addEventListener('click', () => {
        document.getElementById('announcement-modal').classList.add('active');
    });

    document.getElementById('announcement-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('announcement-title').value.trim();
        const content = document.getElementById('announcement-body').value.trim();

        state.announcements.unshift({
            id: Date.now(),
            date: new Date().toISOString(),
            title,
            content
        });
        const ann = state.announcements[0];

        logActivity("Post Announcement", `Notice posted: ${title}`);
        showToast("Notice posted to board.");
        syncAnnouncement(ann);
        saveStateToStorage();
        document.getElementById('announcement-modal').classList.remove('active');
        document.getElementById('announcement-form').reset();
        renderAnnouncementsList();
    });

    // Admin management
    document.getElementById('add-admin-btn').addEventListener('click', () => openAdminModal());
    document.getElementById('admin-form').addEventListener('submit', saveAdminUser);
    document.querySelectorAll('.clear-logs-action').forEach(btn => {
        btn.addEventListener('click', clearActivityLogs);
    });
    
    // Render admin users and activity logs
    renderAdminUsersTable();
    renderActivityLogsTable();
}

function renderAdminUsersTable() {
    const tbody = document.getElementById('admin-users-table-body');
    tbody.innerHTML = '';
    
    const adminUsers = state.adminUsers || [];
    
    adminUsers.forEach(admin => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHTML(admin.username)}</strong></td>
            <td>${escapeHTML(admin.name)}</td>
            <td><span style="padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: ${admin.role === 'Super Admin' ? 'var(--danger-bg)' : admin.role === 'Admin' ? 'var(--primary-bg)' : 'var(--info-bg)'}; color: ${admin.role === 'Super Admin' ? 'var(--danger)' : admin.role === 'Admin' ? 'var(--primary)' : 'var(--info)'};">${admin.role}</span></td>
            <td>${admin.created_at ? new Date(admin.created_at).toLocaleDateString() : 'N/A'}</td>
            <td>
                <button class="btn-mini edit-btn-mini" onclick="openAdminModal('${admin.username}')" title="Edit Admin">
                    <i class="ph-bold ph-pencil-simple"></i>
                    <span class="btn-label">Edit</span>
                </button>
                ${admin.username !== 'admin' ? `
                <button class="btn-mini hard-delete-btn-mini" onclick="deleteAdminUser('${admin.username}')" title="Delete Admin">
                    <i class="ph-bold ph-trash"></i>
                    <span class="btn-label">Delete</span>
                </button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    if (adminUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px;">No admin users found.</td></tr>`;
    }
}

function renderActivityLogsTable() {
    const tbody = document.getElementById('activity-logs-table-body');
    tbody.innerHTML = '';
    
    const logs = state.auditLogs || [];
    
    logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size: 11px; color: var(--text-muted);">${log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</td>
            <td style="font-weight: 700;">${escapeHTML(log.action)}</td>
            <td style="font-size: 12px;">${escapeHTML(log.details)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 40px;">No activity logs found.</td></tr>`;
    }
}

function openAdminModal(username = null) {
    const modal = document.getElementById('admin-modal');
    const title = document.getElementById('admin-modal-title');
    const form = document.getElementById('admin-form');
    
    form.reset();
    document.getElementById('edit-admin-username').value = '';
    
    if (username) {
        // Edit Mode
        const admin = state.adminUsers.find(a => a.username === username);
        if (admin) {
            title.textContent = `Edit Admin: ${admin.username}`;
            document.getElementById('edit-admin-username').value = admin.username;
            document.getElementById('admin-username').value = admin.username;
            document.getElementById('admin-username').disabled = true;
            document.getElementById('admin-name').value = admin.name;
            document.getElementById('admin-role').value = admin.role;
            document.getElementById('admin-password').placeholder = 'Leave blank to keep current password';
        }
    } else {
        // Add Mode
        title.textContent = 'Add New Admin User';
        document.getElementById('admin-username').disabled = false;
        document.getElementById('admin-password').placeholder = 'Enter password';
    }
    
    modal.classList.add('active');
}

async function saveAdminUser(e) {
    e.preventDefault();
    ensureStateDefaults();
    
    const editUsername = document.getElementById('edit-admin-username').value;
    const username = document.getElementById('admin-username').value.trim();
    const name = document.getElementById('admin-name').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    const role = document.getElementById('admin-role').value;
    
    if (editUsername) {
        // Edit existing admin
        const idx = state.adminUsers.findIndex(a => a.username === editUsername);
        if (idx !== -1) {
            state.adminUsers[idx].name = name;
            state.adminUsers[idx].role = role;
            if (password) {
                state.adminUsers[idx].password = password;
            }
            syncAdminUser({ username, name, role, password });
            logActivity("Edit Admin", `Updated admin user ${username}`);
            showToast("Admin user updated successfully.");
        }
    } else {
        // Add new admin
        if (!password) {
            alert("Password is required for new admin users.");
            return;
        }
        if (state.adminUsers.some(admin => String(admin.username || '').toLowerCase() === username.toLowerCase())) {
            alert("An admin user with this username already exists.");
            return;
        }
        state.adminUsers.push({
            username,
            name,
            password,
            role,
            created_at: new Date().toISOString()
        });
        syncAdminUser({ username, name, role, password });
        logActivity("Add Admin", `Created new admin user ${username}`);
        showToast("New admin user added successfully.");
    }
    
    saveStateToStorage();
    document.getElementById('admin-modal').classList.remove('active');
    renderAdminUsersTable();
}

function deleteAdminUser(username) {
    if (confirm(`Are you sure you want to delete admin user "${username}"? This action cannot be undone.`)) {
        state.adminUsers = state.adminUsers.filter(a => a.username !== username);
        logActivity("Delete Admin", `Deleted admin user ${username}`);
        showToast("Admin user deleted successfully.");
        syncAdminDelete(username);
        saveStateToStorage();
        renderAdminUsersTable();
    }
}

async function clearActivityLogs() {
    if (confirm("Clear all activity logs? This action cannot be undone.")) {
        state.auditLogs = [];
        if (isOnline) {
            try {
                await postJsonAction('clear_logs');
            } catch (e) {
                console.error("Failed to clear server logs:", e);
            }
        }
        showToast("Activity logs cleared successfully.");
        saveStateToStorage();
        renderActivityLogsTable();
    }
}

function checkPasscodeGateStatus() {
    const lockScreen = document.getElementById('lock-screen');
    const logoutBtn = document.getElementById('sidebar-logout-btn');
    
    // Set branding in passcode view
    document.getElementById('lock-company-title').textContent = state.admin.companyName;

    if (state.admin.loginEnabled) {
        const isAuthed = sessionStorage.getItem("attendflow_logged_in") === "true";
        if (!isAuthed) {
            lockScreen.style.display = 'flex';
            logoutBtn.style.display = 'none';
        } else {
            lockScreen.style.display = 'none';
            logoutBtn.style.display = 'block';
        }
    } else {
        lockScreen.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
}

function setupLockGateListener() {
    const form = document.getElementById('lock-form');
    const logoutBtn = document.getElementById('sidebar-logout-btn');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('lock-username').value.trim() || 'admin';
        const input = document.getElementById('lock-password').value.trim();
        const errMsg = document.getElementById('lock-error-msg');

        try {
            if (isOnline) {
                const res = await fetch(`${API_URL}?action=login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password: input })
                });
                const json = await res.json();
                if (!res.ok || json.status !== 'success') throw new Error(json.message || 'Invalid login');
                state.currentUser = json.data;
                sessionStorage.setItem("attendflow_logged_in", "true");
                sessionStorage.setItem("attendflow_current_user", JSON.stringify(json.data));
                await refreshStateFromServer({ silent: false, force: true });
            } else {
                ensureStateDefaults();
                const adminUser = state.adminUsers.find(user => String(user.username || '').toLowerCase() === username.toLowerCase());
                const userPassword = adminUser?.password || '';
                const passwordMatchesUser = adminUser && input === userPassword;
                const passwordMatchesLegacyAdmin = username.toLowerCase() === 'admin' && (input === state.admin.password || !state.admin.password);
                if (!passwordMatchesUser && !passwordMatchesLegacyAdmin) {
                    throw new Error('Invalid password');
                }
                state.currentUser = {
                    username: adminUser?.username || username,
                    role: adminUser?.role || 'Super Admin',
                    name: adminUser?.name || username
                };
                sessionStorage.setItem("attendflow_logged_in", "true");
                sessionStorage.setItem("attendflow_current_user", JSON.stringify(state.currentUser));
            }

            errMsg.style.display = "none";
            document.getElementById('lock-password').value = "";
            checkPasscodeGateStatus();
            showToast("Authenticated successfully.");
            renderAll();
        } catch (error) {
            errMsg.style.display = "block";
        }
    });

    logoutBtn.addEventListener('click', () => {
        if (isOnline) {
            fetch(`${API_URL}?action=logout`, { method: 'POST' }).catch(() => {});
        }
        sessionStorage.removeItem("attendflow_logged_in");
        sessionStorage.removeItem("attendflow_current_user");
        state.currentUser = null;
        checkPasscodeGateStatus();
        showToast("Logged out of console.", true);
    });
}

// ----------------------------------------------------
// Core Init App
// ----------------------------------------------------
async function initApp() {
    await loadStateFromStorage();
    const storedUser = sessionStorage.getItem("attendflow_current_user");
    if (storedUser) {
        try {
            state.currentUser = JSON.parse(storedUser);
        } catch (e) {
            state.currentUser = null;
        }
    }
    
    // Default current ISO week
    if (!state.currentWeek) {
        state.currentWeek = getISOWeekString(new Date());
    }

    // Set styling theme classes on body initially
    if (state.theme === 'dark') {
        document.body.classList.add('dark-theme');
    }
    if (state.colorTheme) {
        document.body.classList.add(`color-${state.colorTheme}`);
    }

    // Update branding headers
    document.getElementById('sidebar-company-name').textContent = state.admin.companyName;
    document.getElementById('app-footer-title').textContent = state.admin.companyName;

    // Week navigation controls
    setupWeekPicker();
    setupDayRangeToggle();

    // Standard Listeners Setup
    setupNavigation();
    setupEmployeeForm();
    setupLockGateListener();
    setupAttendanceListeners();
    setupHolidayControls();
    setupSettingsListeners();
    setupReportExportButtons();
    
    // Security: Setup session timeout
    resetSessionTimeout();
    
    // Perform Gate checks
    checkPasscodeGateStatus();

    // Initial view rendering
    renderAll();
    startAutoSync();
}

// ----------------------------------------------------
// Security Functions
// ----------------------------------------------------
let sessionTimeout = null;
let SESSION_TIMEOUT_MINUTES = 30; // 30 minutes of inactivity

function resetSessionTimeout() {
    if (sessionTimeout) clearTimeout(sessionTimeout);
    
    if (state.admin.loginEnabled) {
        sessionTimeout = setTimeout(() => {
            // Auto logout after timeout
            sessionStorage.removeItem("attendflow_logged_in");
            checkPasscodeGateStatus();
            showToast("Session expired due to inactivity. Please login again.", true);
        }, SESSION_TIMEOUT_MINUTES * 60 * 1000);
    }
}

// Reset timeout on user activity
document.addEventListener('click', resetSessionTimeout);
document.addEventListener('keypress', resetSessionTimeout);
document.addEventListener('scroll', resetSessionTimeout);

function checkAccessControl(requiredRole = 'Admin') {
    if (!state.admin.loginEnabled) return true;
    // Role hierarchy: Super Admin > Admin > Viewer
    const roleHierarchy = {
        'Super Admin': 3,
        'HR Manager': 2,
        'Admin': 2,
        'Supervisor': 1,
        'Viewer': 1
    };
    
    const currentUserRole = state.currentUser?.role || 'Admin';
    const requiredLevel = roleHierarchy[requiredRole] || 2;
    const userLevel = roleHierarchy[currentUserRole] || 2;
    
    return userLevel >= requiredLevel;
}

function enforceAccessControl(action, requiredRole = 'Admin') {
    if (!checkAccessControl(requiredRole)) {
        showToast(`Access denied. ${requiredRole} role required.`, true);
        return false;
    }
    return true;
}

function setupWeekPicker() {
    const prevBtn = document.getElementById('prev-week-btn');
    const nextBtn = document.getElementById('next-week-btn');
    const hiddenInput = document.getElementById('week-selector-input');
    const calendarTrigger = document.getElementById('calendar-trigger-btn');

    hiddenInput.value = state.currentWeek;

    prevBtn.addEventListener('click', () => changeWeek(-1));
    nextBtn.addEventListener('click', () => changeWeek(1));
    
    hiddenInput.addEventListener('change', (e) => {
        if (e.target.value) {
            state.currentWeek = e.target.value;
            saveStateToStorage();
            renderAll();
        }
    });

    calendarTrigger.addEventListener('click', () => {
        hiddenInput.showPicker();
    });
}

function changeWeek(direction) {
    const parts = state.currentWeek.split('-W');
    const year = parseInt(parts[0], 10);
    const week = parseInt(parts[1], 10);

    const targetThursday = getThursdayOfWeek(year, week);
    targetThursday.setDate(targetThursday.getDate() + (direction * 7));
    
    state.currentWeek = getISOWeekString(targetThursday);
    document.getElementById('week-selector-input').value = state.currentWeek;
    saveStateToStorage();
    renderAll();
}

function getThursdayOfWeek(year, week) {
    const jan4 = new Date(year, 0, 4);
    const dayOfJan4 = jan4.getDay();
    const monOfW1 = new Date(jan4.getTime() - ((dayOfJan4 === 0 ? 7 : dayOfJan4) - 1) * 24 * 60 * 60 * 1000);
    const monday = new Date(monOfW1.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    return new Date(monday.getTime() + 3 * 24 * 60 * 60 * 1000);
}

function setupDayRangeToggle() {
    const toggle6 = document.getElementById('toggle-6-days');
    const toggle7 = document.getElementById('toggle-7-days');

    const updateBtns = (days) => {
        if (days === 7) {
            toggle7.classList.add('active'); toggle6.classList.remove('active');
        } else {
            toggle6.classList.add('active'); toggle7.classList.remove('active');
        }
    };

    toggle6.addEventListener('click', () => {
        state.dayRange = 6;
        updateBtns(6);
        saveStateToStorage();
        syncSettings();
        renderAll();
    });

    toggle7.addEventListener('click', () => {
        state.dayRange = 7;
        updateBtns(7);
        saveStateToStorage();
        syncSettings();
        renderAll();
    });

    updateBtns(state.dayRange);
}

function renderAll() {
    const dates = getWeekDatesRange(state.currentWeek, state.dayRange);
    document.getElementById('week-range-text').textContent = formatDatesRangeText(dates);

    // Refresh whichever tab is active
    if (state.activeTab === 'dashboard-section') {
        renderDashboardOverview();
    } else if (state.activeTab === 'attendance-section') {
        switchSubTab('attendance-section', state.activeSubTab);
    } else if (state.activeTab === 'employees-section') {
        renderEmployeesList();
    } else if (state.activeTab === 'payroll-section') {
        switchSubTab('payroll-section', state.activeSubTab);
    } else if (state.activeTab === 'reports-section') {
        renderReportsPanel();
    } else if (state.activeTab === 'settings-section') {
        loadSettingsFormValues();
    }
}

// ----------------------------------------------------
// Search box filters
// ----------------------------------------------------
const searchEl = document.getElementById('employee-search');
if (searchEl) {
    searchEl.addEventListener('input', () => {
        renderEmployeesList();
    });
}
const statusFilterEl = document.getElementById('employee-status-filter');
if (statusFilterEl) {
    statusFilterEl.addEventListener('change', () => {
        renderEmployeesList();
    });
}

const categoryFilterEl = document.getElementById('employee-category-filter');
if (categoryFilterEl) {
    categoryFilterEl.addEventListener('change', () => {
        renderEmployeesList();
    });
}

// ----------------------------------------------------
// Export PDF salary slip logic
// ----------------------------------------------------
function exportIndividualPDF(emp, countPresent, countOT, countAbsent, countOff, salary) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('portrait', 'pt', 'a4');

        const dates = getWeekDatesRange(state.currentWeek, state.dayRange);
        const dateStr = formatDatesRangeText(dates);
        const pageW = doc.internal.pageSize.width;
        const pageH = doc.internal.pageSize.height;

        // Elegant double borders
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(1.5);
        doc.rect(20, 20, pageW - 40, pageH - 40);

        // Header Background block
        doc.setFillColor(15, 23, 42);
        doc.rect(25, 25, pageW - 50, 80, 'F');
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text(state.admin.companyName, pageW / 2, 60, { align: "center" });
        doc.setFontSize(11);
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(209, 213, 219);
        doc.text("WEEKLY SALARY SLIP & ATTENDANCE STATEMENT", pageW / 2, 85, { align: "center" });

        // Reset text values
        doc.setTextColor(15, 23, 42);
        let y = 140;
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.text("EMPLOYEE INFORMATION", 40, y);
        doc.text("PAYMENT DETAILS", pageW / 2 + 20, y);

        doc.line(40, y + 6, pageW - 40, y + 6);

        y += 24;
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Employee Name: ${emp.name}`, 40, y);
        doc.text(`Worker ID: ${emp.id}`, 40, y + 18);
        doc.text(`Designation: ${emp.designation || 'N/A'}`, 40, y + 36);

        doc.text(`Statement Week: ${state.currentWeek}`, pageW / 2 + 20, y);
        doc.text(`Date Range: ${dateStr}`, pageW / 2 + 20, y + 18);
        doc.text(`Report Date: ${new Date().toLocaleDateString('en-IN')}`, pageW / 2 + 20, y + 36);

        // Build log entries table
        y += 65;
        doc.setFont("Helvetica", "bold");
        doc.text("DAY-WISE ATTENDANCE LOG", 40, y);

        const slipHeaders = ["Day Name", "Calendar Date", "Attendance Status"];
        const slipRows = [];

        dates.forEach((dObj, index) => {
            const dateStr = formatDateYYYYMMDD(dObj);
            const status = (state.attendance[dateStr] && state.attendance[dateStr][emp.id] && state.attendance[dateStr][emp.id].status) || 'Present';
            slipRows.push([
                DAYS_FULL[index],
                dObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                status
            ]);
        });

        doc.autoTable({
            head: [slipHeaders],
            body: slipRows,
            startY: y + 12,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] },
            margin: { left: 40, right: 40 }
        });

        y = doc.autoTable.previous.finalY + 30;

        doc.setFillColor(249, 250, 251);
        doc.rect(40, y, pageW - 80, 75, 'F');

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text("Present Days", 60, y + 24);
        doc.text("Overtime Days", 180, y + 24);
        doc.text("Absent Days", 300, y + 24);
        doc.text("Scheduled Off Days", 420, y + 24);

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(17, 24, 39);
        doc.text(String(countPresent), 60, y + 46);
        doc.text(String(countOT), 180, y + 46);
        doc.text(String(countAbsent), 300, y + 46);
        doc.text(String(countOff), 420, y + 46);

        // Highlight Net Payout block
        doc.setFillColor(37, 99, 235);
        doc.rect(pageW - 220, y, 180, 75, 'F');
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("TOTAL NET SALARY", pageW - 200, y + 28);
        doc.setFontSize(18);
        drawPdfCurrencyAmount(doc, salary, pageW - 200, y + 54, {
            fontSize: 18,
            fontWeight: 700,
            color: [255, 255, 255],
            maxWidth: 160
        });

        // Signatures
        y += 130;
        doc.setDrawColor(156, 163, 175);
        doc.line(60, y, 200, y);
        doc.line(pageW - 200, y, pageW - 60, y);
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(17, 24, 39);
        doc.text("Authorized Admin Signature", 60, y + 16);
        doc.text("Worker Signature", pageW - 200, y + 16);

        const cleanName = emp.name.replace(/\s+/g, '');
        doc.save(`${cleanName}_Weekly_Report.pdf`);

    } catch (e) {
        console.error(e);
        alert("Failed to build PDF salary slip.");
    }
}

// ----------------------------------------------------
// SheetJS Excel Generator
// ----------------------------------------------------
const EXCEL_CURRENCY_FORMAT = '[$\u20B9-en-IN]#,##0;[Red]-[$\u20B9-en-IN]#,##0';

function setExcelCurrencyCell(ws, rowIndex, colIndex, amount) {
    const ref = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
    if (!ws[ref]) return;
    ws[ref].t = 'n';
    ws[ref].v = getFiniteCurrencyAmount(amount);
    ws[ref].z = EXCEL_CURRENCY_FORMAT;
}

function setExcelTextCell(ws, rowIndex, colIndex, value) {
    const ref = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
    if (!ws[ref]) return;
    ws[ref].t = 's';
    ws[ref].v = String(value ?? '');
}

function autoFitWorksheetColumns(ws, rows, displayOverrides = {}) {
    const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    ws['!cols'] = Array.from({ length: colCount }, (_, colIndex) => {
        let maxLength = 10;
        rows.forEach((row, rowIndex) => {
            const override = displayOverrides[`${rowIndex}:${colIndex}`];
            const rawValue = override !== undefined ? override : row[colIndex];
            const textValue = rawValue === null || rawValue === undefined ? '' : String(rawValue);
            maxLength = Math.max(maxLength, textValue.length);
        });

        return { wch: Math.min(Math.max(maxLength + 2, 10), 34) };
    });
}

function exportToExcel() {
    if (state.employees.length === 0) {
        alert('No data to export.');
        return;
    }

    try {
        const dates = getWeekDatesRange(state.currentWeek, state.dayRange);
        const dateStr = formatDatesRangeText(dates);
        const activeDays = DAYS_SHORT.slice(0, state.dayRange);

        const sheetData = [];
        sheetData.push([`Company Name: ${state.admin.companyName || 'ABIRAMI INDUSTRIES'}`]);
        sheetData.push(["WEEKLY ATTENDANCE AND PAYROLL REPORT"]);
        sheetData.push([`Week ID: ${state.currentWeek}`, `Week Date: ${dateStr}`, `Exported: ${new Date().toLocaleString('en-IN')}`]);
        sheetData.push([]);

        const headers = ["Employee ID", "Employee Name", "Category", "Department"];
        activeDays.forEach(d => headers.push(d));
        headers.push("Total Present", "OT", "Absent", "Off Day", "Total Salary");
        sheetData.push(headers);

        const displayOverrides = {};
        const salaryCells = [];
        let grandTotalPayout = 0;
        state.employees.forEach(emp => {
            if (emp.status === 'Archived') return;
            
            const row = [
                emp.id,
                emp.name,
                emp.category || 'Permanent',
                emp.department || 'Production'
            ];
            let countPresent = 0;
            let countOT = 0;
            let countAbsent = 0;
            let countOff = 0;

            activeDays.forEach((day, dayIndex) => {
                const dateKey = formatDateYYYYMMDD(dates[dayIndex]);
                const status = (state.attendance[dateKey] && state.attendance[dateKey][emp.id] && state.attendance[dateKey][emp.id].status) || 'Present';
                row.push(status);
                
                if (status === 'Present') countPresent++;
                else if (status === 'Present + OT') { countPresent++; countOT++; }
                else if (status === 'Absent') countAbsent++;
                else if (status === 'Off Day') countOff++;
                else if (status === 'Half Day') countPresent += 0.5;
            });

            const salary = (countPresent * emp.rates.present) + 
                           (countOT * emp.rates.present_ot) + 
                           (countAbsent * emp.rates.absent) + 
                           (countOff * emp.rates.off_day);
            
            grandTotalPayout += salary;
            row.push(countPresent, countOT, countAbsent, countOff, salary);
            sheetData.push(row);
            const rowIndex = sheetData.length - 1;
            const salaryColIndex = row.length - 1;
            salaryCells.push({ rowIndex, colIndex: salaryColIndex, amount: salary });
            displayOverrides[`${rowIndex}:${salaryColIndex}`] = formatDisplayCurrency(salary);
        });

        sheetData.push([]);
        const totalRow = Array(headers.length).fill("");
        totalRow[0] = "GRAND TOTAL PAYOUT";
        totalRow[headers.length - 1] = grandTotalPayout;
        sheetData.push(totalRow);
        const totalRowIndex = sheetData.length - 1;
        salaryCells.push({ rowIndex: totalRowIndex, colIndex: headers.length - 1, amount: grandTotalPayout });
        displayOverrides[`${totalRowIndex}:${headers.length - 1}`] = formatDisplayCurrency(grandTotalPayout);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }
        ];
        salaryCells.forEach(cell => setExcelCurrencyCell(ws, cell.rowIndex, cell.colIndex, cell.amount));
        setExcelTextCell(ws, 0, 0, `Company Name: ${state.admin.companyName || 'ABIRAMI INDUSTRIES'}`);
        autoFitWorksheetColumns(ws, sheetData, displayOverrides);

        XLSX.utils.book_append_sheet(wb, ws, "Payroll Summary");
        XLSX.writeFile(wb, `${sanitizeFilePart(state.admin.companyName)}_Payroll_Report_${state.currentWeek}.xlsx`);
    } catch (e) {
        console.error(e);
        alert('An error occurred during Excel export.');
    }
}

function exportToPDF() {
    // Landscape week matrix PDF (legacy logic)
    if (state.employees.length === 0) {
        alert('No data to export.');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'pt', 'a4');

        const dates = getWeekDatesRange(state.currentWeek, state.dayRange);
        const dateStr = formatDatesRangeText(dates);
        const activeDays = DAYS_SHORT.slice(0, state.dayRange);

        const tableHeaders = ["Employee Name"];
        activeDays.forEach(d => tableHeaders.push(d));
        tableHeaders.push("PR", "OT", "AB", "OFF", "Salary");

        const tableRows = [];
        const salaryAmounts = [];
        let totalPayoutSum = 0;

        state.employees.forEach(emp => {
            if (emp.status === 'Archived') return;
            const rowData = [emp.name];
            let countPresent = 0;
            let countOT = 0;
            let countAbsent = 0;
            let countOff = 0;

            dates.forEach(dObj => {
                const dateStr = formatDateYYYYMMDD(dObj);
                const status = (state.attendance[dateStr] && state.attendance[dateStr][emp.id] && state.attendance[dateStr][emp.id].status) || 'Present';
                rowData.push(status);
                
                if (status === 'Present') countPresent++;
                else if (status === 'Present + OT') { countPresent++; countOT++; }
                else if (status === 'Absent') countAbsent++;
                else if (status === 'Off Day') countOff++;
                else if (status === 'Half Day') countPresent += 0.5;
            });

            const salary = (countPresent * emp.rates.present) + 
                           (countOT * emp.rates.present_ot) + 
                           (countAbsent * emp.rates.absent) + 
                           (countOff * emp.rates.off_day);
            totalPayoutSum += salary;
            salaryAmounts.push(salary);

            rowData.push(countPresent, countOT, countAbsent, countOff, '');
            tableRows.push(rowData);
        });

        // Banner Header
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, doc.internal.pageSize.width, 100, 'F');
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text("ATTENDFLOW PAYROLL SYSTEM", 40, 48);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(156, 163, 175);
        doc.text(`Week: ${state.currentWeek}   |   Dates: ${dateStr}`, 40, 75);

        doc.autoTable({
            head: [tableHeaders],
            body: tableRows,
            startY: 130,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] },
            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === tableHeaders.length - 1) {
                    drawPdfCurrencyAmountInCell(doc, data.cell, salaryAmounts[data.row.index], {
                        fontSize: 8,
                        fontWeight: 500,
                        align: 'right'
                    });
                }
            }
        });

        doc.save(`Weekly_Payroll_Report_${state.currentWeek}.pdf`);
    } catch (e) {
        console.error(e);
        alert('Failed to generate PDF document.');
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function updateDropdownClass(select) {
    select.classList.remove('val-present', 'val-ot', 'val-absent', 'val-off', 'val-half', 'val-leave', 'val-holiday');
    const val = select.value;
    if (val === 'Present') select.classList.add('val-present');
    else if (val === 'Present + OT') select.classList.add('val-ot');
    else if (val === 'Absent') select.classList.add('val-absent');
    else if (val === 'Off Day') select.classList.add('val-off');
    else if (val === 'Half Day') select.classList.add('val-half');
    else if (val === 'Leave') select.classList.add('val-leave');
    else if (val === 'Holiday') select.classList.add('val-holiday');
}

// ----------------------------------------------------
// Exposure of public API calls to inline buttons
// ----------------------------------------------------
window.app = {
    // View tab switcher
    switchView: (viewId, subTabId = null) => switchView(viewId, subTabId),
    
    // Workers handlers
    openAddEmployeeModal: () => openModal(),
    openEditModal: (id) => openModal(id),
    toggleArchiveEmployee: (id) => toggleArchiveEmployee(id),
    hardDeleteEmployee: (id) => hardDeleteEmployee(id),
    
    // PDF handlers
    downloadPdfSlip: (empId) => {
        const emp = state.employees.find(e => e.id === empId);
        if (!emp) return;
        const dates = getWeekDatesRange(state.currentWeek, state.dayRange);
        
        let countPresent = 0;
        let countOT = 0;
        let countAbsent = 0;
        let countOff = 0;

        dates.forEach(dObj => {
            const dStr = formatDateYYYYMMDD(dObj);
            const s = (state.attendance[dStr] && state.attendance[dStr][emp.id] && state.attendance[dStr][emp.id].status) || 'Present';
            if (s === 'Present') countPresent++;
            else if (s === 'Present + OT') { countPresent++; countOT++; }
            else if (s === 'Absent') countAbsent++;
            else if (s === 'Off Day') countOff++;
            else if (s === 'Half Day') countPresent += 0.5;
        });

        const salary = (countPresent * emp.rates.present) + 
                       (countOT * emp.rates.present_ot) + 
                       (countAbsent * emp.rates.absent) + 
                       (countOff * emp.rates.off_day);

        exportIndividualPDF(emp, countPresent, countOT, countAbsent, countOff, salary);
    },
    
    // Holiday operations
    removeHoliday: (dateStr) => removeHoliday(dateStr)
};

// Start Console logic
window.addEventListener('DOMContentLoaded', () => {
    initApp();
});
