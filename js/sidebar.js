/**
 * Sidebar Navigation Component
 * Handles the generation, injection, and toggling of the sliding menu.
 */

function initSidebar() {
    if (!currentUser) return; // Don't render sidebar if not logged in

    // 1. Inject HTML into body
    if (!document.getElementById('slideSidebar')) {
        const sidebarHtml = `
            <!-- Overlay -->
            <div id="sidebarOverlay" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity opacity-0 pointer-events-none md:hidden" onclick="toggleSidebar()"></div>
            
            <!-- Sidebar -->
            <aside id="slideSidebar" class="fixed top-0 left-0 h-screen w-72 glass-card !rounded-none md:!rounded-r-2xl z-50 transform -translate-x-full md:translate-x-0 transition-transform duration-300 flex flex-col shadow-2xl border-l-0 border-y-0">
                <div class="p-6 border-b border-slate-200/50 flex justify-between items-center bg-white/30">
                    <h2 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 drop-shadow-sm"><i class="fas fa-layer-group mr-2 text-indigo-600"></i>เมนูหลัก</h2>
                    <button onclick="toggleSidebar()" class="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-full transition-colors focus:outline-none md:hidden">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div class="p-4 flex-grow overflow-y-auto custom-scrollbar">
                    <ul id="sidebarNavList" class="space-y-1"></ul>
                </div>
                <div class="p-6 border-t border-slate-200/50 bg-slate-50/50">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center font-bold text-lg shadow-inner">
                            ${currentUser.name.charAt(0)}
                        </div>
                        <div class="overflow-hidden">
                            <p class="font-semibold text-slate-800 truncate">${currentUser.name}</p>
                            <p class="text-xs text-indigo-600 font-medium truncate">${getRoleText(currentUser.role)}</p>
                        </div>
                    </div>
                </div>
            </aside>
        `;
        document.body.insertAdjacentHTML('beforeend', sidebarHtml);
    }

    // 2. Build Menu Items based on Role
    updateSidebarNavigation();
}

function updateSidebarNavigation() {
    const navList = document.getElementById('sidebarNavList');
    if (!navList || !currentUser) return;

    navList.innerHTML = '';
    const buttons = [];
    const pageName = window.location.pathname.split('/').pop() || 'index.html';

    if (currentUser.role === 'admin' || currentUser.role === 'head') {
        buttons.push({ text: 'แดชบอร์ด', page: 'dashboard.html', icon: 'fa-chart-line' });
        buttons.push({ text: 'ตรวจสอบรายคน', page: 'individual-submissions.html', icon: 'fa-user-check' });
        buttons.push({ text: 'ตรวจสอบรายภาระงาน', page: 'assignment-submissions.html', icon: 'fa-clipboard-check' });
        buttons.push({ text: 'จัดการงาน', page: 'assignment-management.html', icon: 'fa-tasks' });
    }

    if (currentUser.role === 'admin') {
        buttons.push({ text: 'จัดการบุคลากร', page: 'teacher-management.html', icon: 'fa-users' });
        buttons.push({ text: 'จัดการกลุ่มสาระฯ', page: 'department-management.html', icon: 'fa-building' });
        buttons.push({ text: 'จัดการกลุ่มงาน', page: 'work-group-management.html', icon: 'fa-layer-group' });
        buttons.push({ text: 'ตั้งค่าระบบ', page: 'system-settings.html', icon: 'fa-tools' });
    }

    // งานของฉัน และ โปรไฟล์ของฉัน (แสดงทุกบทบาท)
    buttons.push({ text: 'งานของฉัน', page: 'my-tasks.html', icon: 'fa-clipboard-list' });
    buttons.push({ text: 'โปรไฟล์ของฉัน', page: 'my-profile.html', icon: 'fa-cog' });

    buttons.forEach(btn => {
        const li = document.createElement('li');
        const isActive = pageName === btn.page;
        
        const baseClasses = "flex items-center gap-3 px-4 py-2 rounded-xl font-medium transition-all duration-200 group";
        const activeClasses = isActive 
            ? "bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 shadow-sm border border-indigo-100" 
            : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600";
            
        const iconClasses = isActive
            ? "text-indigo-600"
            : "text-slate-400 group-hover:text-indigo-500 transition-colors";

        li.innerHTML = `
            <a href="${btn.page}" class="${baseClasses} ${activeClasses}">
                <i class="fas ${btn.icon} w-6 text-center text-lg ${iconClasses}"></i>
                <span>${btn.text}</span>
            </a>
        `;
        navList.appendChild(li);
    });
}

function toggleSidebar() {
    const sidebar = document.getElementById('slideSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!sidebar || !overlay) return;

    const isOpen = !sidebar.classList.contains('-translate-x-full');

    if (isOpen) {
        // Close
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('opacity-0');
        overlay.classList.add('pointer-events-none');
    } else {
        // Open
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('opacity-0');
        overlay.classList.remove('pointer-events-none');
    }
}
