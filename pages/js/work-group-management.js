// Work Group Management
        function loadWorkGroupManagement() {
            updateWorkGroupStats();
            renderWorkGroupsTable();
            setupWorkGroupSearch();
        }

        function updateWorkGroupStats() {
            const totalWorkGroups = systemData.workGroups.length;
            const workGroupsWithLeader = systemData.workGroups.filter(wg => wg.leaderId).length;
            
            document.getElementById('totalWorkGroups').textContent = totalWorkGroups;
            document.getElementById('workGroupsWithLeader').textContent = workGroupsWithLeader;
        }

        function renderWorkGroupsTable(filters = {}) {
            const tbody = document.getElementById('workGroupsTableBody');
            tbody.innerHTML = '';

            let workGroups = systemData.workGroups;

            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                workGroups = workGroups.filter(wg => wg.name.toLowerCase().includes(searchTerm));
            }

            if (workGroups.length === 0) {
                const colSpan = 6;
                tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-8 text-gray-500">ไม่พบข้อมูลกลุ่มงาน</td></tr>`;
                return;
            }

            workGroups.forEach(workGroup => {
                const leader = workGroup.leaderId ? systemData.teachers.find(t => t.id === workGroup.leaderId) : null;
                const leaderName = leader ? leader.name : 'ไม่มีหัวหน้า';

                const row = document.createElement('tr');
                row.className = 'border-b hover:bg-gray-50';
                row.innerHTML = `
                    <td class="px-6 py-4">${workGroup.id}</td>
                    <td class="px-6 py-4">${workGroup.name}</td>
                    <td class="px-6 py-4">${leaderName}</td>
                    <td class="px-6 py-4">${workGroup.description}</td>
                    <td class="px-6 py-4">
                        <span class="badge ${workGroup.status === 'ใช้งาน' ? 'badge-green' : 'badge-gray'}">${workGroup.status}</span>
                    </td>
                    <td class="px-6 py-4">
                        <button onclick="editWorkGroup('${workGroup.id}')" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteWorkGroup('${workGroup.id}')" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        function setupWorkGroupSearch() {
            const searchInput = document.getElementById('searchWorkGroupInput');
            if (searchInput) {
                // Remove existing listeners to avoid multiple fires
                const newSearchInput = searchInput.cloneNode(true);
                searchInput.parentNode.replaceChild(newSearchInput, searchInput);
                newSearchInput.addEventListener('input', (e) => {
                    renderWorkGroupsTable({ search: e.target.value });
                });
            }
        }

        function showAddWorkGroupModal() {
            const teachers = systemData.teachers.filter(t => t.position === 'หัวหน้ากลุ่มสาระฯ' || t.position === 'ครูผู้สอน');
            const teacherOptions = teachers.map(t => `<option value="${t.id}">${t.name} (${t.department})</option>`).join('');

            Swal.fire({
                title: 'เพิ่มกลุ่มงาน',
                html: `
                    <form id="addWorkGroupForm" class="text-left">
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ชื่อกลุ่มงาน</label>
                            <input type="text" name="workGroupName" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รายละเอียด</label>
                            <textarea name="description" class="w-full px-4 py-2 border rounded-lg" rows="3" required></textarea>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">หัวหน้ากลุ่ม</label>
                            <select name="leaderId" class="w-full px-4 py-2 border rounded-lg">
                                <option value="">ไม่มีหัวหน้า</option>
                                ${teacherOptions}
                            </select>
                        </div>
                    </form>
                `,
                showCancelButton: true,
                confirmButtonText: 'เพิ่ม',
                cancelButtonText: 'ยกเลิก',
                preConfirm: () => {
                    const form = document.getElementById('addWorkGroupForm');
                    const workGroupName = form.workGroupName.value;
                    const description = form.description.value;
                    const leaderId = form.leaderId.value || null;

                    // Generate new work group ID
                    const lastIdNum = systemData.workGroups.reduce((maxId, wg) => {
                        const currentIdNum = parseInt(wg.id.replace('WG', ''), 10);
                        return currentIdNum > maxId ? currentIdNum : maxId;
                    }, 0);
                    const newWorkGroupId = 'WG' + (lastIdNum + 1).toString().padStart(3, '0');

                    if (!workGroupName || !description) {
                        Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                        return false;
                    }
                    return { workGroupId: newWorkGroupId, workGroupName, description, leaderId };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(() => {
                        const newWorkGroup = {
                            id: result.value.workGroupId,
                            name: result.value.workGroupName,
                            description: result.value.description,
                            leaderId: result.value.leaderId,
                            status: 'ใช้งาน'
                        };
                        systemData.workGroups.push(newWorkGroup);
                        saveSystemData(systemData);
                        loadWorkGroupManagement();
                        Swal.fire('สำเร็จ', 'เพิ่มกลุ่มงานเรียบร้อย', 'success');
                        hideLoading();
                    }, 500);
                }
            });
        }

        function editWorkGroup(workGroupId) {
            const workGroup = systemData.workGroups.find(wg => wg.id === workGroupId);
            if (!workGroup) return;

            const teachers = systemData.teachers.filter(t => t.position === 'หัวหน้ากลุ่มสาระฯ' || t.position === 'ครูผู้สอน');
            const teacherOptions = teachers.map(t => 
                `<option value="${t.id}" ${t.id === workGroup.leaderId ? 'selected' : ''}>${t.name} (${t.department})</option>`
            ).join('');

            Swal.fire({
                title: 'แก้ไขกลุ่มงาน',
                html: `
                    <form id="editWorkGroupForm" class="text-left">
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รหัสกลุ่มงาน</label>
                            <input type="text" value="${workGroup.id}" class="w-full px-4 py-2 border rounded-lg bg-gray-100" disabled>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ชื่อกลุ่มงาน</label>
                            <input type="text" name="workGroupName" value="${workGroup.name}" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รายละเอียด</label>
                            <textarea name="description" class="w-full px-4 py-2 border rounded-lg" rows="3" required>${workGroup.description}</textarea>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">หัวหน้ากลุ่ม</label>
                            <select name="leaderId" class="w-full px-4 py-2 border rounded-lg">
                                <option value="" ${!workGroup.leaderId ? 'selected' : ''}>ไม่มีหัวหน้า</option>
                                ${teacherOptions}
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">สถานะ</label>
                            <select name="status" class="w-full px-4 py-2 border rounded-lg">
                                <option value="ใช้งาน" ${workGroup.status === 'ใช้งาน' ? 'selected' : ''}>ใช้งาน</option>
                                <option value="ไม่ใช้งาน" ${workGroup.status === 'ไม่ใช้งาน' ? 'selected' : ''}>ไม่ใช้งาน</option>
                            </select>
                        </div>
                    </form>
                `,
                showCancelButton: true,
                confirmButtonText: 'บันทึก',
                cancelButtonText: 'ยกเลิก',
                preConfirm: () => {
                    const form = document.getElementById('editWorkGroupForm');
                    return {
                        workGroupName: form.workGroupName.value,
                        description: form.description.value,
                        leaderId: form.leaderId.value || null,
                        status: form.status.value
                    };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(() => {
                        workGroup.name = result.value.workGroupName;
                        workGroup.description = result.value.description;
                        workGroup.leaderId = result.value.leaderId;
                        workGroup.status = result.value.status;
                        saveSystemData(systemData);
                        loadWorkGroupManagement();
                        Swal.fire('สำเร็จ', 'แก้ไขกลุ่มงานเรียบร้อย', 'success');
                        hideLoading();
                    }, 500);
                }
            });
        }

        function deleteWorkGroup(workGroupId) {
            const assignmentsInGroup = systemData.assignments.filter(a => a.workGroupId === workGroupId);
            
            if (assignmentsInGroup.length > 0) {
                Swal.fire({
                    icon: 'error',
                    title: 'ไม่สามารถลบได้',
                    text: 'มีงานที่อยู่ในกลุ่มงานนี้ กรุณาลบงานเหล่านั้นก่อน'
                });
                return;
            }

            Swal.fire({
                title: 'ลบกลุ่มงาน?',
                text: 'คุณต้องการลบกลุ่มงานนี้หรือไม่?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'ลบ',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#ef4444'
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(() => {
                        systemData.workGroups = systemData.workGroups.filter(wg => wg.id !== workGroupId);
                        saveSystemData(systemData);
                        loadWorkGroupManagement();
                        Swal.fire('สำเร็จ', 'ลบกลุ่มงานเรียบร้อย', 'success');
                        hideLoading();
                    }, 500);
                }
            });
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            if (!currentUser || currentUser.role !== 'admin') {
                window.location.href = 'dashboard.html';
                return;
            }
            loadWorkGroupManagement();
        });

        window.onSystemDataSynced = function(data) {
            loadWorkGroupManagement();
        };