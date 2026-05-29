// Data Storage Keys
const STORAGE_KEY = 'teacherSubmissionSystem';
const CURRENT_USER_KEY = 'teacherSubmissionCurrentUser';

// Default Configuration for the UI theme and titles
const defaultConfig = {
    system_title: "ระบบติดตามการส่งงานครู",
    school_name: "โรงเรียนบ้านสร้างสื่อ",
    footer_text: "© 2025 โรงเรียนบ้านสร้างสื่อ",
    primary_color: "#4f46e5", // Indigo 600
    secondary_color: "#0ea5e9", // Sky 500
    text_color: "#0f172a", // Slate 900
    background_color: "#f8fafc", // Slate 50
    accent_color: "#f43f5e", // Rose 500
    gas_api_url: "https://script.google.com/macros/s/AKfycbxgP07PqbIxeQxP_BHo40dQrOmfMy0XR_bYM-EDjDzSKxjv39XsMUVM2M4qEMIo8xfg/exec"
};

// Initialize System Data and Session
let systemData = getSystemData();
let currentUser = getCurrentUser();

// Get current system configuration or default
function getSystemSettings() {
    return systemData.settings || defaultConfig;
}

// Check if GAS API URL is set
function getGasUrl() {
    if (systemData && systemData.settings && typeof systemData.settings.gas_api_url === 'string') {
        if (systemData.settings.gas_api_url.trim() === '') return '';
        return systemData.settings.gas_api_url;
    }
    return "https://script.google.com/macros/s/AKfycbxgP07PqbIxeQxP_BHo40dQrOmfMy0XR_bYM-EDjDzSKxjv39XsMUVM2M4qEMIo8xfg/exec";
}

// Fetch system data from LocalStorage or initialize default values
function getSystemData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        return JSON.parse(data);
    }
    return {
        settings: {},
        users: [],
        departments: [],
        teachers: [],
        workGroups: [],
        assignments: [],
        notifications: [],
        submissions: []
    };
}

// Save system data locally and sync with Google Sheets (GAS)
function saveSystemData(data) {
    if (!data.settings) data.settings = {};
    data.settings.lastUpdated = Date.now().toString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    systemData = data;
    syncDataToGAS(data);
}

// Asynchronously sync data to Google Sheets via GAS
async function syncDataToGAS(data) {
    const gasUrl = getGasUrl();
    if (!gasUrl) return;
    try {
        const response = await fetch(gasUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                action: 'syncData',
                data: data
            })
        });
        const resJson = await response.json();
        if (!resJson.success) {
            console.error("GAS Sync Error:", resJson.error);
        }
    } catch (err) {
        console.error("GAS Sync Network Error:", err);
    }
}

// Asynchronously fetch latest data from GAS using JSONP (bypasses CORS)
function syncDataFromGAS() {
    const gasUrl = getGasUrl();
    if (!gasUrl) return;

    // Create a unique callback name
    const callbackName = 'gasCallback_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    window[callbackName] = function (data) {
        // Clean up script tag and callback
        delete window[callbackName];
        const scriptTag = document.getElementById(callbackName);
        if (scriptTag) scriptTag.remove();

        if (data && !data.error) {
            // Check if remote data is newer than local data
            const localDataStr = localStorage.getItem(STORAGE_KEY);
            let shouldUpdate = true;
            if (localDataStr) {
                const localData = JSON.parse(localDataStr);
                const localTime = localData.settings && localData.settings.lastUpdated ? parseInt(localData.settings.lastUpdated) : 0;
                const remoteTime = data.settings && data.settings.lastUpdated ? parseInt(data.settings.lastUpdated) : 0;

                // If local data is newer (e.g. pending save to GAS), do not overwrite
                if (localTime >= remoteTime && localTime > 0) {
                    shouldUpdate = false;
                }
            }

            if (shouldUpdate) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                systemData = data;

                applySystemSettings();

                if (typeof window.onSystemDataSynced === 'function') {
                    window.onSystemDataSynced(data);
                }
            }
        } else if (data && data.error) {
            console.error("GAS Sync Error:", data.error);
        }
    };

    // Inject script tag for JSONP
    const script = document.createElement('script');
    script.id = callbackName;
    script.src = gasUrl + (gasUrl.includes('?') ? '&' : '?') + 'callback=' + callbackName;
    script.onerror = function () {
        console.error("JSONP fetch failed. Check GAS URL, Deployment permissions, or network.");
        delete window[callbackName];
        script.remove();
    };
    document.body.appendChild(script);
}



// User state helper functions

/**
 * Hash a plaintext password using SHA-256 (Web Crypto API)
 * @param {string} password The plaintext password
 * @returns {Promise<string>} The 64-character hex hash string
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCurrentUser() {
    const userJson = sessionStorage.getItem(CURRENT_USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
}

function setCurrentUser(user) {
    if (user) {
        sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
        sessionStorage.removeItem(CURRENT_USER_KEY);
    }
    currentUser = user;
}

function getRoleText(role) {
    const roles = {
        'admin': 'ผู้ดูแลระบบ',
        'head': 'หัวหน้ากลุ่มสาระฯ',
        'teacher': 'ครูผู้สอน'
    };
    return roles[role] || role;
}

function logout() {
    Swal.fire({
        title: 'ออกจากระบบ?',
        text: 'คุณต้องการออกจากระบบหรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ออกจากระบบ',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            setCurrentUser(null);
            const isInPages = window.location.pathname.includes('/pages/');
            window.location.href = isInPages ? '../index.html' : 'index.html';
        }
    });
}

// Apply colors and titles from settings to page elements
function applySystemSettings() {
    const settings = systemData.settings || defaultConfig;

    const elements = {
        'systemTitle': settings.system_title || defaultConfig.system_title,
        'schoolName': settings.school_name || defaultConfig.school_name,
        'footerText': settings.footer_text || defaultConfig.footer_text,
        'loginSystemTitle-branding': settings.system_title || defaultConfig.system_title,
        'loginSchoolName-branding': settings.school_name || defaultConfig.school_name
    };

    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // Apply styling tokens
    const primaryColor = settings.primary_color || defaultConfig.primary_color;
    const secondaryColor = settings.secondary_color || defaultConfig.secondary_color;
    const textColor = settings.text_color || defaultConfig.text_color;
    const backgroundColor = settings.background_color || defaultConfig.background_color;

    document.body.style.backgroundColor = backgroundColor;
    document.body.style.color = textColor;

    const header = document.querySelector('header');
    if (header) header.style.backgroundColor = primaryColor;
}

// Build Navigation Bar depending on user role (Moved to sidebar.js)

// Notification Helpers
function createNotification(userId, message, type, link) {
    const newNotification = {
        id: 'N' + Date.now() + Math.random().toString(36).substr(2, 5),
        userId: userId,
        message: message,
        type: type,
        link: link,
        isRead: false,
        timestamp: new Date().toISOString()
    };
    systemData.notifications.unshift(newNotification);
    saveSystemData(systemData);
    updateNotificationUI();
}

function updateNotificationUI() {
    if (!currentUser) return;

    const userNotifications = (systemData.notifications || []).filter(n => n.userId === currentUser.id);
    const unreadCount = userNotifications.filter(n => !n.isRead).length;

    const badge = document.getElementById('notificationBadge');
    if (badge) badge.classList.toggle('hidden', unreadCount === 0);

    const list = document.getElementById('notificationList');
    if (!list) return;

    list.innerHTML = '';

    if (userNotifications.length === 0) {
        list.innerHTML = '<p class="p-4 text-center text-gray-500 text-sm">ไม่มีการแจ้งเตือน</p>';
        return;
    }

    userNotifications.forEach(n => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = `block p-4 hover:bg-gray-100 ${!n.isRead ? 'bg-blue-50' : ''}`;
        item.onclick = (e) => {
            e.preventDefault();
            markNotificationAsRead(n.id);
            toggleNotificationDropdown(false);
            window.location.href = n.link;
        };

        const icon = n.type === 'new_assignment' ? 'fa-plus-circle text-green-500' : 'fa-clock text-orange-500';
        const timeAgo = new Date(n.timestamp);

        item.innerHTML = `
            <div class="flex items-start gap-3">
                <i class="fas ${icon} mt-1"></i>
                <div>
                    <p class="text-sm">${n.message}</p>
                    <p class="text-xs text-gray-500 mt-1">${timeAgo.toLocaleString('th-TH')}</p>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

function toggleNotificationDropdown(forceState) {
    const dropdown = document.getElementById('notificationDropdown');
    if (!dropdown) return;
    const isHidden = dropdown.style.display === 'none' || dropdown.style.display === '';

    if (typeof forceState === 'boolean') {
        dropdown.style.display = forceState ? 'block' : 'none';
    } else {
        dropdown.style.display = isHidden ? 'block' : 'none';
    }
}

function markNotificationAsRead(notificationId) {
    const notification = systemData.notifications.find(n => n.id === notificationId);
    if (notification && !notification.isRead) {
        notification.isRead = true;
        saveSystemData(systemData);
        updateNotificationUI();
    }
}

function markAllNotificationsAsRead() {
    systemData.notifications.forEach(n => {
        if (n.userId === currentUser.id) {
            n.isRead = true;
        }
    });
    saveSystemData(systemData);
    updateNotificationUI();
}

// Real Email Notification via GAS
async function sendEmailNotification(teacherId, subject, body) {
    const teacher = systemData.teachers.find(t => t.id === teacherId);
    if (!teacher || !teacher.email) return;

    const gasUrl = getGasUrl();
    if (gasUrl) {
        try {
            // Call GAS Web App to send real email
            await fetch(gasUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: JSON.stringify({
                    action: 'sendEmail',
                    to: teacher.email,
                    subject: subject,
                    body: body
                })
            });
            console.log(`[REAL EMAIL SENT to ${teacher.email}]`);
        } catch (err) {
            console.error("Failed to send real email:", err);
        }
    } else {
        console.warn(`[SIMULATED EMAIL to ${teacher.email}] (GAS URL is missing)`);
    }

    // If the email is to the current user, show a toast to make it visible in demo
    if (currentUser && currentUser.id === teacherId) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: `(คุณได้รับอีเมลจริง) ${subject}`,
            text: 'ส่งไปยัง ' + teacher.email,
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true
        });
    }
}

// Check for approaching deadlines and send email reminders (1 day before)
function checkApproachingDeadlines() {
    let hasChanges = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    systemData.submissions.forEach(sub => {
        if (sub.status === 'ยังไม่ส่ง' && !sub.reminderSent) {
            const assignment = systemData.assignments.find(a => a.id === sub.assignmentId);
            if (assignment) {
                const dueDate = new Date(assignment.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                
                const timeDiff = dueDate.getTime() - today.getTime();
                const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                // If deadline is today or tomorrow (<= 1 day) and not passed
                if (daysDiff >= 0 && daysDiff <= 1) {
                    sendEmailNotification(
                        sub.teacherId,
                        `แจ้งเตือนใกล้ถึงกำหนดส่งงาน: ${assignment.name}`,
                        `เรียนคุณครู,\n\nงาน "${assignment.name}" กำหนดส่งวันที่ ${formatThaiDate(assignment.dueDate)} (เหลือเวลาอีก ${daysDiff === 0 ? 'วันนีั' : daysDiff + ' วัน'})\nกรุณาเข้าสู่ระบบเพื่อส่งงาน\n\nขอบคุณครับ`
                    );
                    sub.reminderSent = true;
                    hasChanges = true;
                }
            }
        }
    });

    if (hasChanges) {
        saveSystemData(systemData);
    }
}

// Upload file to Google Drive via Apps Script Web App
async function uploadFileToGAS(fileName, base64Data, mimeType) {
    const gasUrl = getGasUrl();
    if (!gasUrl) {
        throw new Error("ระบบทำงานในโหมดออฟไลน์ (กรุณาระบุ GAS URL ในหน้าตั้งค่าระบบ เพื่ออัปโหลดไปยัง Google Drive)");
    }
    const response = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
            action: 'uploadFile',
            fileName: fileName,
            fileData: base64Data,
            mimeType: mimeType
        })
    });
    const result = await response.json();
    if (result.success) {
        return result.file; // returns object with id, url, name
    } else {
        throw new Error(result.error || "ไม่สามารถอัปโหลดไฟล์ไปยัง Drive ได้");
    }
}

// Loading Spinner control
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
}

// Element SDK initialization
if (window.elementSdk) {
    window.elementSdk.init({
        defaultConfig: defaultConfig,
        onConfigChange: async (config) => {
            const systemTitle = config.system_title || defaultConfig.system_title;
            const schoolName = config.school_name || defaultConfig.school_name;
            const footerText = config.footer_text || defaultConfig.footer_text;
            const primaryColor = config.primary_color || defaultConfig.primary_color;
            const secondaryColor = config.secondary_color || defaultConfig.secondary_color;
            const textColor = config.text_color || defaultConfig.text_color;
            const backgroundColor = config.background_color || defaultConfig.background_color;

            const titleEl = document.getElementById('systemTitle');
            if (titleEl) titleEl.textContent = systemTitle;

            const brandTitle = document.getElementById('loginSystemTitle-branding');
            if (brandTitle) brandTitle.textContent = systemTitle;

            const brandSchool = document.getElementById('loginSchoolName-branding');
            if (brandSchool) brandSchool.textContent = schoolName;

            const nameEl = document.getElementById('schoolName');
            if (nameEl) nameEl.textContent = schoolName;

            const footerEl = document.getElementById('footerText');
            if (footerEl) footerEl.textContent = footerText;

            document.body.style.backgroundColor = backgroundColor;
            document.body.style.color = textColor;

            const header = document.querySelector('header');
            if (header) header.style.backgroundColor = primaryColor;
        },
        mapToCapabilities: (config) => ({
            recolorables: [
                {
                    get: () => config.primary_color || defaultConfig.primary_color,
                    set: (value) => {
                        if (window.elementSdk) window.elementSdk.setConfig({ primary_color: value });
                    }
                },
                {
                    get: () => config.secondary_color || defaultConfig.secondary_color,
                    set: (value) => {
                        if (window.elementSdk) window.elementSdk.setConfig({ secondary_color: value });
                    }
                },
                {
                    get: () => config.text_color || defaultConfig.text_color,
                    set: (value) => {
                        if (window.elementSdk) window.elementSdk.setConfig({ text_color: value });
                    }
                },
                {
                    get: () => config.background_color || defaultConfig.background_color,
                    set: (value) => {
                        if (window.elementSdk) window.elementSdk.setConfig({ background_color: value });
                    }
                },
                {
                    get: () => config.accent_color || defaultConfig.accent_color,
                    set: (value) => {
                        if (window.elementSdk) window.elementSdk.setConfig({ accent_color: value });
                    }
                }
            ],
            borderables: [],
            fontEditable: undefined,
            fontSizeable: undefined
        }),
        mapToEditPanelValues: (config) => new Map([
            ["system_title", config.system_title || defaultConfig.system_title],
            ["school_name", config.school_name || defaultConfig.school_name],
            ["footer_text", config.footer_text || defaultConfig.footer_text]
        ])
    });
}

// Run on page DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    if (typeof initNavbar === 'function') initNavbar();
    if (typeof initFooter === 'function') initFooter();

    applySystemSettings();

    const userInfoEl = document.getElementById('userInfo');
    if (currentUser) {
        if (userInfoEl) userInfoEl.classList.remove('hidden');

        const userNameEl = document.getElementById('currentUserName');
        if (userNameEl) userNameEl.textContent = currentUser.name;

        const userRoleEl = document.getElementById('currentUserRole');
        if (userRoleEl) userRoleEl.textContent = getRoleText(currentUser.role);

        if (typeof initSidebar === 'function') initSidebar();
        updateNotificationUI();

        // Setup notification click outside to close dropdown
        document.addEventListener('click', function (event) {
            const dropdown = document.getElementById('notificationDropdown');
            if (dropdown) {
                const bellBtn = dropdown.previousElementSibling || document.querySelector('button[onclick="toggleNotificationDropdown()"]');
                if (bellBtn && !dropdown.contains(event.target) && !bellBtn.contains(event.target)) {
                    toggleNotificationDropdown(false);
                }
            }
        });
        
        checkApproachingDeadlines();
    } else {
        if (userInfoEl) userInfoEl.classList.add('hidden');
    }

    // Perform background data fetch from Google Sheets
    syncDataFromGAS();
});

// Helper to format date into Thai display
function formatThaiDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543;
    
    return `${day} ${month} ${year}`;
}
