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
                <div class="p-4 border-t border-slate-200/50 bg-slate-50/50">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-3 overflow-hidden">
                            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center font-bold text-lg shadow-inner">
                                ${currentUser.name.charAt(0)}
                            </div>
                            <div class="overflow-hidden">
                                <p class="font-semibold text-slate-800 truncate text-sm" title="${currentUser.name}">${currentUser.name}</p>
                                <p class="text-xs text-indigo-600 font-medium truncate">${getRoleText(currentUser.role)}</p>
                            </div>
                        </div>
                        <button onclick="logout()" class="flex-shrink-0 bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white w-10 h-10 flex items-center justify-center rounded-lg transition-colors shadow-sm border border-rose-100 hover:border-rose-500 focus:outline-none" title="ออกจากระบบ">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
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
    const menuGroups = [];
    const pageName = window.location.pathname.split('/').pop() || 'index.html';

    // Top Level: Dashboard (Everyone)
    const isDashActive = pageName === 'dashboard.html';
    const baseClassesDash = "flex items-center gap-3 px-4 py-2 mb-2 rounded-xl font-medium transition-all duration-200 group";
    const activeClassesDash = isDashActive 
        ? "bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 shadow-sm border border-indigo-100" 
        : "text-slate-700 hover:bg-slate-50 hover:text-indigo-600";
    const iconClassesDash = isDashActive
        ? "text-indigo-600"
        : "text-slate-400 group-hover:text-indigo-500 transition-colors";

    const dashLi = document.createElement('li');
    dashLi.innerHTML = `
        <a href="dashboard.html" class="${baseClassesDash} ${activeClassesDash}">
            <i class="fas fa-chart-line w-6 text-center text-lg ${iconClassesDash}"></i>
            <span class="font-bold text-sm drop-shadow-sm">แดชบอร์ด</span>
        </a>
    `;
    navList.appendChild(dashLi);

    // 1. Personal Workspace (Everyone)
    menuGroups.push({
        id: 'menu-personal',
        title: 'พื้นที่ส่วนตัว',
        icon: 'fa-user-circle',
        items: [
            { text: 'งานของฉัน', page: 'my-tasks.html', icon: 'fa-clipboard-list' },
            { text: 'โปรไฟล์ของฉัน', page: 'my-profile.html', icon: 'fa-cog' }
        ]
    });

    // 2. Tracking & Monitoring (Admin, Head)
    if (currentUser.role === 'admin' || currentUser.role === 'head') {
        menuGroups.push({
            id: 'menu-tracking',
            title: 'การติดตามและการประเมิน',
            icon: 'fa-chart-pie',
            items: [
                { text: 'ตรวจสอบรายคน', page: 'individual-submissions.html', icon: 'fa-user-check' },
                { text: 'ตรวจสอบรายภาระงาน', page: 'assignment-submissions.html', icon: 'fa-clipboard-check' }
            ]
        });
    }

    // 3. System Management (Admin, Head)
    if (currentUser.role === 'admin' || currentUser.role === 'head') {
        const sysItems = [];
        sysItems.push({ text: 'จัดการงาน', page: 'assignment-management.html', icon: 'fa-tasks' });
        
        if (currentUser.role === 'admin') {
            sysItems.push({ text: 'จัดการบุคลากร', page: 'teacher-management.html', icon: 'fa-users' });
            sysItems.push({ text: 'จัดการกลุ่มสาระฯ', page: 'department-management.html', icon: 'fa-building' });
            sysItems.push({ text: 'จัดการกลุ่มงาน', page: 'work-group-management.html', icon: 'fa-layer-group' });
            sysItems.push({ text: 'ตั้งค่าระบบ', page: 'system-settings.html', icon: 'fa-tools' });
        }
        
        menuGroups.push({
            id: 'menu-system',
            title: 'การจัดการระบบ',
            icon: 'fa-cogs',
            items: sysItems
        });
    }

    // Load saved states from localStorage
    const savedStates = JSON.parse(localStorage.getItem('sidebarMenuStates')) || {};

    menuGroups.forEach((group, index) => {
        // Auto open if active page is inside this group
        const hasActiveItem = group.items.some(item => item.page === pageName);
        let isOpen = savedStates[group.id] !== undefined ? savedStates[group.id] : (hasActiveItem || index === 0);
        
        // If it has active item, force it open
        if (hasActiveItem) isOpen = true;

        const groupEl = document.createElement('div');
        groupEl.className = 'mb-1';
        
        let itemsHtml = '';
        group.items.forEach(btn => {
            const isActive = pageName === btn.page;
            const baseClasses = "flex items-center gap-3 px-4 py-2 rounded-xl font-medium transition-all duration-200 group";
            const activeClasses = isActive 
                ? "bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 shadow-sm border border-indigo-100" 
                : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600";
            const iconClasses = isActive
                ? "text-indigo-600"
                : "text-slate-400 group-hover:text-indigo-500 transition-colors";

            itemsHtml += `
                <li>
                    <a href="${btn.page}" class="${baseClasses} ${activeClasses}">
                        <i class="fas ${btn.icon} w-6 text-center text-lg ${iconClasses}"></i>
                        <span class="text-sm">${btn.text}</span>
                    </a>
                </li>
            `;
        });

        groupEl.innerHTML = `
            <button onclick="toggleSubmenu('${group.id}')" class="w-full flex items-center justify-between px-3 py-2 text-slate-700 hover:text-indigo-700 hover:bg-indigo-50/50 rounded-lg transition-colors group focus:outline-none">
                <div class="flex items-center gap-2">
                    <i class="fas ${group.icon} w-5 text-center text-slate-400 group-hover:text-indigo-500 transition-colors"></i>
                    <span class="font-bold text-sm drop-shadow-sm">${group.title}</span>
                </div>
                <i id="icon-${group.id}" class="fas fa-chevron-down text-xs text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}"></i>
            </button>
            <ul id="submenu-${group.id}" class="space-y-1 mt-1 overflow-hidden transition-all duration-300" style="max-height: ${isOpen ? '500px' : '0px'}; opacity: ${isOpen ? '1' : '0'};">
                ${itemsHtml}
            </ul>
        `;
        navList.appendChild(groupEl);
    });
}

function toggleSubmenu(groupId) {
    const submenu = document.getElementById('submenu-' + groupId);
    const icon = document.getElementById('icon-' + groupId);
    if (!submenu || !icon) return;

    const isOpen = submenu.style.maxHeight !== '0px';
    
    if (isOpen) {
        submenu.style.maxHeight = '0px';
        submenu.style.opacity = '0';
        icon.classList.remove('rotate-180');
    } else {
        submenu.style.maxHeight = '500px';
        submenu.style.opacity = '1';
        icon.classList.add('rotate-180');
    }

    // Save state
    const savedStates = JSON.parse(localStorage.getItem('sidebarMenuStates')) || {};
    savedStates[groupId] = !isOpen;
    localStorage.setItem('sidebarMenuStates', JSON.stringify(savedStates));
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
