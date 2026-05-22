// Department Management
        function loadDepartmentManagement() {
            updateDepartmentStats();
            renderDepartmentsTable();
            setupDepartmentSearch();
        }

        function updateDepartmentStats() {
            const totalDepartments = systemData.departments.length;
            const totalTeachers = systemData.teachers.length;
            const departmentsWithHead = systemData.departments.filter(d => d.headId).length;
            
            document.getElementById('totalDepartmentsCount').textContent = totalDepartments;
            document.getElementById('totalTeachersInDept').textContent = totalTeachers;
            document.getElementById('departmentsWithHead').textContent = departmentsWithHead;
        }

        function renderDepartmentsTable(filters = {}) {
            const tbody = document.getElementById('departmentsTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            let departments = systemData.departments;

            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                departments = departments.filter(d => d.name.toLowerCase().includes(searchTerm));
            }

            if (departments.length === 0) {
                const colSpan = 6;
                tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-8 text-gray-500">ไม่พบข้อมูลกลุ่มสาระฯ</td></tr>`;
                return;
            }

            departments.forEach(department => {
                const head = department.headId ? systemData.teachers.find(t => t.id === department.headId) : null;
                const headName = head ? head.name : 'ไม่มีหัวหน้า';
                const teacherCount = systemData.teachers.filter(t => t.department === department.name).length;

                const row = document.createElement('tr');
                row.className = 'border-b hover:bg-gray-50';
                row.innerHTML = `
                    <td class="px-6 py-4">${department.name}</td>
                    <td class="px-6 py-4">${headName}</td>
                    <td class="px-6 py-4">${teacherCount} คน</td>
                    <td class="px-6 py-4">${department.description}</td>
                    <td class="px-6 py-4">
                        <span class="badge ${department.status === 'ใช้งาน' ? 'badge-green' : 'badge-gray'}">${department.status}</span>
                    </td>
                    <td class="px-6 py-4">
                        <button onclick="editDepartment('${department.id}')" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteDepartment('${department.id}')" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        function setupDepartmentSearch() {
            const searchInput = document.getElementById('searchDepartmentInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    renderDepartmentsTable({ search: e.target.value });
                });
            }
        }

        function showAddDepartmentModal() {
            const teachers = systemData.teachers.filter(t => t.position === 'หัวหน้ากลุ่มสาระฯ' || t.position === 'ครูผู้สอน');
            const teacherOptions = teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

            Swal.fire({
                title: 'เพิ่มกลุ่มสาระการเรียนรู้',
                html: `
                    <form id="addDepartmentForm" class="text-left">
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ชื่อกลุ่มสาระฯ</label>
                            <input type="text" name="departmentName" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รายละเอียด</label>
                            <textarea name="description" class="w-full px-4 py-2 border rounded-lg" rows="3" required></textarea>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">หัวหน้ากลุ่มสาระฯ</label>
                            <select name="headId" class="w-full px-4 py-2 border rounded-lg">
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
                    const form = document.getElementById('addDepartmentForm');
                    const departmentName = form.departmentName.value;
                    const description = form.description.value;
                    const headId = form.headId.value || null;

                    // Generate new department ID
                    const lastIdNum = systemData.departments.reduce((maxId, d) => {
                        const currentIdNum = parseInt(d.id.replace('DEPT', ''), 10);
                        return currentIdNum > maxId ? currentIdNum : maxId;
                    }, 0);
                    const newDepartmentId = 'DEPT' + (lastIdNum + 1).toString().padStart(3, '0');

                    if (!departmentName || !description) {
                        Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                        return false;
                    }

                    if (systemData.departments.find(d => d.name === departmentName)) {
                        Swal.showValidationMessage('ชื่อกลุ่มสาระฯ นี้มีอยู่แล้ว');
                        return false;
                    }

                    return { departmentId: newDepartmentId, departmentName, description, headId };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(() => {
                        const newDepartment = {
                            id: result.value.departmentId,
                            name: result.value.departmentName,
                            description: result.value.description,
                            headId: result.value.headId,
                            status: 'ใช้งาน'
                        };
                        systemData.departments.push(newDepartment);
                        saveSystemData(systemData);
                        loadDepartmentManagement();
                        Swal.fire('สำเร็จ', 'เพิ่มกลุ่มสาระฯ เรียบร้อย', 'success');
                        hideLoading();
                    }, 500);
                }
            });
        }

        function editDepartment(departmentId) {
            const department = systemData.departments.find(d => d.id === departmentId);
            if (!department) return;

            const teachers = systemData.teachers.filter(t => t.position === 'หัวหน้ากลุ่มสาระฯ' || t.position === 'ครูผู้สอน');
            const teacherOptions = teachers.map(t => 
                `<option value="${t.id}" ${t.id === department.headId ? 'selected' : ''}>${t.name}</option>`
            ).join('');

            Swal.fire({
                title: 'แก้ไขกลุ่มสาระการเรียนรู้',
                html: `
                    <form id="editDepartmentForm" class="text-left">
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รหัสกลุ่มสาระฯ</label>
                            <input type="text" value="${department.id}" class="w-full px-4 py-2 border rounded-lg bg-gray-100" disabled>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ชื่อกลุ่มสาระฯ</label>
                            <input type="text" name="departmentName" value="${department.name}" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รายละเอียด</label>
                            <textarea name="description" class="w-full px-4 py-2 border rounded-lg" rows="3" required>${department.description}</textarea>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">หัวหน้ากลุ่มสาระฯ</label>
                            <select name="headId" class="w-full px-4 py-2 border rounded-lg">
                                <option value="" ${!department.headId ? 'selected' : ''}>ไม่มีหัวหน้า</option>
                                ${teacherOptions}
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">สถานะ</label>
                            <select name="status" class="w-full px-4 py-2 border rounded-lg">
                                <option value="ใช้งาน" ${department.status === 'ใช้งาน' ? 'selected' : ''}>ใช้งาน</option>
                                <option value="ไม่ใช้งาน" ${department.status === 'ไม่ใช้งาน' ? 'selected' : ''}>ไม่ใช้งาน</option>
                            </select>
                        </div>
                    </form>
                `,
                showCancelButton: true,
                confirmButtonText: 'บันทึก',
                cancelButtonText: 'ยกเลิก',
                preConfirm: () => {
                    const form = document.getElementById('editDepartmentForm');
                    const departmentName = form.departmentName.value;
                    
                    if (departmentName !== department.name && systemData.departments.find(d => d.name === departmentName)) {
                        Swal.showValidationMessage('ชื่อกลุ่มสาระฯ นี้มีอยู่แล้ว');
                        return false;
                    }

                    return {
                        departmentName: departmentName,
                        description: form.description.value,
                        headId: form.headId.value || null,
                        status: form.status.value
                    };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(() => {
                        const oldName = department.name;
                        department.name = result.value.departmentName;
                        department.description = result.value.description;
                        department.headId = result.value.headId;
                        department.status = result.value.status;

                        // อัปเดตชื่อกลุ่มสาระฯ ในข้อมูลครู
                        if (oldName !== result.value.departmentName) {
                            systemData.teachers.forEach(teacher => {
                                if (teacher.department === oldName) {
                                    teacher.department = result.value.departmentName;
                                }
                            });
                        }

                        saveSystemData(systemData);
                        loadDepartmentManagement();
                        Swal.fire('สำเร็จ', 'แก้ไขกลุ่มสาระฯ เรียบร้อย', 'success');
                        hideLoading();
                    }, 500);
                }
            });
        }

        function deleteDepartment(departmentId) {
            const department = systemData.departments.find(d => d.id === departmentId);
            if (!department) return;

            const teachersInDept = systemData.teachers.filter(t => t.department === department.name);
            
            if (teachersInDept.length > 0) {
                Swal.fire({
                    icon: 'error',
                    title: 'ไม่สามารถลบได้',
                    text: 'มีครูที่อยู่ในกลุ่มสาระฯ นี้ กรุณาย้ายครูเหล่านั้นก่อน'
                });
                return;
            }

            Swal.fire({
                title: 'ลบกลุ่มสาระฯ?',
                text: 'คุณต้องการลบกลุ่มสาระการเรียนรู้นี้หรือไม่?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'ลบ',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#ef4444'
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(() => {
                        systemData.departments = systemData.departments.filter(d => d.id !== departmentId);
                        saveSystemData(systemData);
                        loadDepartmentManagement();
                        Swal.fire('สำเร็จ', 'ลบกลุ่มสาระฯ เรียบร้อย', 'success');
                        hideLoading();
                    }, 500);
                }
            });
        }

        // System sync callback
        window.onSystemDataSynced = function(data) {
            loadDepartmentManagement();
        };

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            if (!currentUser) {
                window.location.href = 'index.html';
                return;
            }

            // Check access rights
            if (currentUser.role !== 'admin') {
                window.location.href = 'dashboard.html';
                return;
            }

            loadDepartmentManagement();
        });