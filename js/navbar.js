/**
 * Dynamic Navbar Component
 * Handles the generation and injection of the top navigation bar.
 */

function initNavbar() {
    if (!currentUser) return; // Don't render navbar if not logged in
    if (document.querySelector('header')) return; // Avoid duplicate headers

    const navbarHtml = `
        <header class="bg-blue-600 text-white shadow-lg no-print">
            <div class="container mx-auto px-4 py-4">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <button onclick="toggleSidebar()" class="text-white/90 hover:text-white transition md:hidden focus:outline-none">
                            <i class="fas fa-bars text-xl"></i>
                        </button>
                        <div>
                            <h1 class="text-2xl font-bold" id="systemTitle">ระบบติดตามการส่งงานครู</h1>
                            <p class="text-sm opacity-90" id="schoolName">โรงเรียนบ้านสร้างสื่อ</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-6" id="userInfo">
                        <!-- Notification Bell -->
                        <div class="relative">
                            <button onclick="toggleNotificationDropdown()" class="text-white hover:text-gray-200 transition focus:outline-none">
                                <i class="fas fa-bell text-xl"></i>
                                <span id="notificationBadge" class="notification-badge hidden"></span>
                            </button>
                            <div id="notificationDropdown" class="text-gray-800 mt-2 shadow-2xl border">
                                <div class="p-4 flex justify-between items-center border-b">
                                    <h4 class="font-bold">การแจ้งเตือน</h4>
                                    <button onclick="markAllNotificationsAsRead()" class="text-sm text-blue-600 hover:underline focus:outline-none">อ่านทั้งหมด</button>
                                </div>
                                <div id="notificationList" class="divide-y">
                                    <!-- Notification items will be injected here -->
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-4">
                            <div class="text-right">
                                <p class="font-semibold text-white" id="currentUserName">ผู้ใช้งาน</p>
                                <p class="text-xs opacity-90 text-white" id="currentUserRole">บทบาท</p>
                            </div>
                            <button onclick="logout()" class="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition focus:outline-none">
                                <i class="fas fa-sign-out-alt mr-2"></i>ออกจากระบบ
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    `;

    document.body.insertAdjacentHTML('afterbegin', navbarHtml);
}
