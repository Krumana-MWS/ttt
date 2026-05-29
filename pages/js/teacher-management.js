// Teacher Management
        function loadTeacherManagement() {
            updateTeacherStats();
            loadTeacherDepartmentFilter();
            renderTeachersTable();
            setupTeacherFilters();
        }

        function updateTeacherStats() {
            const totalTeachers = systemData.teachers.length;
            const departments = [...new Set(systemData.teachers.map(t => t.department))].length;
            
            document.getElementById('totalTeachers').textContent = totalTeachers;
            document.getElementById('totalDepartments').textContent = departments;
        }

        function loadTeacherDepartmentFilter() {
            const departments = systemData.departments.filter(d => d.status === 'ใช้งาน').map(d => d.name);
            const filter = document.getElementById('filterTeacherDepartment');
            if (filter) {
                filter.innerHTML = '<option value="">ทุกกลุ่มสาระฯ</option>';
                departments.forEach(dept => {
                    filter.innerHTML += `<option value="${dept}">${dept}</option>`;
                });
            }
        }

        function renderTeachersTable(filters = {}) {
            const tbody = document.getElementById('teachersTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            let teachers = systemData.teachers;

            if (filters.search) {
                const search = filters.search.toLowerCase();
                teachers = teachers.filter(t => t.name.toLowerCase().includes(search));
            }
            if (filters.department) {
                teachers = teachers.filter(t => t.department === filters.department);
            }

            teachers.forEach(teacher => {
                const teacherSubmissions = systemData.submissions.filter(s => s.teacherId === teacher.id);
                const total = teacherSubmissions.length;
                const pending = teacherSubmissions.filter(s => s.status === 'ยังไม่ส่ง' || s.status === 'ส่งแก้ไข').length;

                const row = document.createElement('tr');
                row.className = 'border-b hover:bg-gray-50';
                row.innerHTML = `
                    <td class="px-6 py-4">${teacher.id}</td>
                    <td class="px-6 py-4">${teacher.name}</td>
                    <td class="px-6 py-4">${teacher.email || '-'}</td>
                    <td class="px-6 py-4">${teacher.department}</td>
                    <td class="px-6 py-4">${teacher.position}</td>
                    <td class="px-6 py-4">งานทั้งหมด ${total}, ค้างส่ง ${pending}</td>
                    <td class="px-6 py-4">
                        <button onclick="editTeacher('${teacher.id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="แก้ไข"><i class="fas fa-edit"></i></button>
                        <button onclick="resetTeacherPassword('${teacher.id}')" class="text-yellow-600 hover:text-yellow-800 mr-2" title="รีเซ็ตรหัสผ่าน"><i class="fas fa-key"></i></button>
                        <button onclick="deleteTeacher('${teacher.id}')" class="text-red-600 hover:text-red-800" title="ลบ"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        function setupTeacherFilters() {
            const searchTeacher = document.getElementById('searchTeacher');
            const filterTeacherDepartment = document.getElementById('filterTeacherDepartment');

            const applyFilters = () => {
                renderTeachersTable({
                    search: searchTeacher.value,
                    department: filterTeacherDepartment.value
                });
            };

            if (searchTeacher) searchTeacher.addEventListener('input', applyFilters);
            if (filterTeacherDepartment) filterTeacherDepartment.addEventListener('change', applyFilters);
        }

        function exportTeachersToCSV() {
            const teachers = systemData.teachers;
            if (teachers.length === 0) {
                Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลบุคลากรที่จะส่งออก', 'info');
                return;
            }

            const header = ['รหัสครู', 'ชื่อ-นามสกุล', 'อีเมล', 'กลุ่มสาระฯ', 'ตำแหน่ง'];
            const csvRows = [header.join(',')];

            teachers.forEach(teacher => {
                const row = [teacher.id, teacher.name, teacher.email || '', teacher.department, teacher.position];
                csvRows.push(row.join(','));
            });

            const csvString = csvRows.join('\n');
            const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });

            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'teachers_export.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function showImportTeacherModal() {
            Swal.fire({
                title: 'นำเข้าข้อมูลบุคลากร',
                html: `
                    <div class="text-left p-4 bg-gray-100 rounded-lg">
                        <p class="font-semibold mb-2">คำแนะนำ:</p>
                        <p class="text-sm mb-2">1. เตรียมไฟล์ข้อมูลในรูปแบบ CSV</p>
                        <p class="text-sm mb-2">2. ไฟล์ต้องมี 5 คอลัมน์ เรียงตามลำดับ: <br>
                           <code class="bg-gray-200 px-2 py-1 rounded">รหัสครู,ชื่อ-นามสกุล,อีเมล,กลุ่มสาระฯ,ตำแหน่ง</code>
                        </p>
                        <p class="text-sm mb-2">3. แถวแรกสุด (Header) จะถูกข้ามไป ไม่นำเข้า</p>
                        <p class="text-sm mb-2">4. ระบบจะสร้างบัญชีผู้ใช้ให้อัตโนมัติ โดยใช้รหัสครูเป็นทั้ง Username และ Password เริ่มต้น</p>
                        <p class="text-sm font-bold text-red-600">ตัวอย่าง:</p>
                        <pre class="bg-gray-200 p-2 rounded text-xs">รหัสครู,ชื่อ-นามสกุล,อีเมล,กลุ่มสาระฯ,ตำแหน่ง
T005,ครูมานะ ขยัน,mana.k@example.com,วิทยาศาสตร์,ครูผู้สอน
T006,ครูใจดี มีเมตตา,jaidee.m@example.com,ภาษาไทย,ครูผู้สอน</pre>
                    </div>
                    <div class="mt-4">
                        <label class="block text-gray-700 font-semibold mb-2">เลือกไฟล์ CSV</label>
                        <input type="file" id="csvFile" accept=".csv" class="w-full">
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'นำเข้า',
                cancelButtonText: 'ยกเลิก',
                preConfirm: () => {
                    const fileInput = document.getElementById('csvFile');
                    const file = fileInput.files[0];
                    if (!file) {
                        Swal.showValidationMessage('กรุณาเลือกไฟล์');
                        return false;
                    }

                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = async (e) => {
                            const text = e.target.result;
                            const rows = text.split('\n').filter(row => row.trim() !== '');
                            const newTeachers = [];
                            const newUsers = [];
                            const errors = [];

                            // Start from 1 to skip header row
                            for (let i = 1; i < rows.length; i++) {
                                const columns = rows[i].split(',').map(col => col.trim());
                                if (columns.length < 5) {
                                    errors.push(`แถวที่ ${i + 1}: รูปแบบข้อมูลไม่ถูกต้อง (ต้องมีอย่างน้อย 5 คอลัมน์)`);
                                    continue;
                                }
                                const [id, name, email, department, position] = columns;
                                if (systemData.teachers.some(t => t.id === id) || systemData.users.some(u => u.id === id)) {
                                    errors.push(`แถวที่ ${i + 1}: รหัสครู '${id}' มีอยู่แล้วในระบบ`);
                                    continue;
                                }
                                newTeachers.push({ id, name, email, department, position, status: 'ปฏิบัติงาน' });
                                const hashedPassword = await hashPassword(id);
                                newUsers.push({ id, password: hashedPassword, role: 'teacher', name, teacherId: id, email: email });
                            }

                            if (errors.length > 0) {
                                Swal.showValidationMessage(`<div class="text-left">${errors.join('<br>')}</div>`);
                                resolve(false);
                            } else {
                                resolve({ newTeachers, newUsers });
                            }
                        };
                        reader.readAsText(file, 'UTF-8');
                    });
                }
            }).then((result) => {
                if (result.isConfirmed && result.value) {
                    const { newTeachers, newUsers } = result.value;
                    if (newTeachers.length > 0) {
                        showLoading();
                        setTimeout(() => {
                            systemData.teachers.push(...newTeachers);
                            systemData.users.push(...newUsers);
                            saveSystemData(systemData);
                            loadTeacherManagement();
                            Swal.fire({
                                icon: 'success',
                                title: 'นำเข้าสำเร็จ',
                                text: `นำเข้าข้อมูลบุคลากรใหม่ ${newTeachers.length} คนเรียบร้อยแล้ว`
                            });
                            hideLoading();
                        }, 500);
                    } else {
                        Swal.fire({
                            icon: 'info',
                            title: 'ไม่มีข้อมูลใหม่',
                            text: 'ไม่พบข้อมูลบุคลากรใหม่ที่จะนำเข้าในไฟล์'
                        });
                    }
                }
            });
        }

        function showAddTeacherModal() {
            const departments = systemData.departments.filter(d => d.status === 'ใช้งาน').map(d => d.name);
            const departmentOptions = departments.map(d => `<option value="${d}">${d}</option>`).join('');

            // Auto-generate next Teacher ID
            let nextIdNum = 1;
            systemData.teachers.forEach(t => {
                if (t.id && t.id.startsWith('T')) {
                    const num = parseInt(t.id.substring(1), 10);
                    if (!isNaN(num) && num >= nextIdNum) {
                        nextIdNum = num + 1;
                    }
                }
            });
            const nextTeacherId = 'T' + nextIdNum.toString().padStart(3, '0');

            Swal.fire({
                title: 'เพิ่มบุคลากร',
                html: `
                    <form id="addTeacherForm" class="text-left">
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รหัสครู (สร้างอัตโนมัติ)</label>
                            <input type="text" name="teacherId" class="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-600" value="${nextTeacherId}" readonly>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ชื่อ-นามสกุล</label>
                            <input type="text" name="teacherName" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">อีเมล</label>
                            <input type="email" name="email" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รหัสผ่านเริ่มต้น</label>
                            <input type="password" name="password" class="w-full px-4 py-2 border rounded-lg" required placeholder="กำหนดรหัสผ่าน">
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">กลุ่มสาระฯ</label>
                            <select name="department" class="w-full px-4 py-2 border rounded-lg" required>
                                ${departmentOptions}
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ตำแหน่ง</label>
                            <select name="position" class="w-full px-4 py-2 border rounded-lg" required>
                                <option value="ครูผู้สอน">ครูผู้สอน</option>
                                <option value="หัวหน้ากลุ่มสาระฯ">หัวหน้ากลุ่มสาระฯ</option>
                            </select>
                        </div>
                        <div class="mb-4 border-t pt-4 mt-6">
                            <label class="block text-indigo-700 font-semibold mb-2"><i class="fas fa-shield-alt mr-2"></i>สิทธิ์การใช้งานระบบ</label>
                            <select name="systemRole" class="w-full px-4 py-2 border border-indigo-300 rounded-lg bg-indigo-50 focus:ring-indigo-500" required>
                                <option value="teacher">ครูผู้สอน / ทั่วไป</option>
                                <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                            </select>
                        </div>
                    </form>
                `,
                showCancelButton: true,
                confirmButtonText: 'เพิ่ม',
                cancelButtonText: 'ยกเลิก',
                preConfirm: () => {
                    const form = document.getElementById('addTeacherForm');
                    const teacherId = form.teacherId.value;
                    const teacherName = form.teacherName.value;
                    const email = form.email.value;
                    const password = form.password.value;
                    const department = form.department.value;
                    const position = form.position.value;
                    const systemRole = form.systemRole ? form.systemRole.value : 'teacher';

                    if (!teacherId || !teacherName || !email || !password || !department || !position || !systemRole) {
                        Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                        return false;
                    }

                    if (systemData.teachers.find(t => t.id === teacherId)) {
                        Swal.showValidationMessage('รหัสครูนี้มีอยู่แล้ว');
                        return false;
                    }

                    return { teacherId, teacherName, email, password, department, position, systemRole };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(async () => {
                        const newTeacher = {
                            id: result.value.teacherId,
                            name: result.value.teacherName,
                            email: result.value.email,
                            department: result.value.department,
                            position: result.value.position,
                            status: 'ปฏิบัติงาน'
                        };
                        systemData.teachers.push(newTeacher);
                        
                        // Auto-create user account with specified password
                        const hashedPassword = await hashPassword(result.value.password);
                        systemData.users.push({
                            id: result.value.teacherId,
                            password: hashedPassword,
                            role: result.value.systemRole,
                            name: result.value.teacherName,
                            teacherId: result.value.teacherId,
                            email: result.value.email
                        });

                        saveSystemData(systemData);
                        loadTeacherManagement();
                        Swal.fire('สำเร็จ', 'เพิ่มบุคลากรเรียบร้อย', 'success');
                        hideLoading();
                    }, 500);
                }
            });
        }

        function editTeacher(teacherId) {
            const teacher = systemData.teachers.find(t => t.id === teacherId);
            if (!teacher) return;

            const departments = systemData.departments.filter(d => d.status === 'ใช้งาน').map(d => d.name);
            const departmentOptions = departments.map(d => `<option value="${d}" ${d === teacher.department ? 'selected' : ''}>${d}</option>`).join('');

            Swal.fire({
                title: 'แก้ไขข้อมูลบุคลากร',
                html: `
                    <form id="editTeacherForm" class="text-left">
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รหัสครู</label>
                            <input type="text" value="${teacher.id}" class="w-full px-4 py-2 border rounded-lg bg-gray-100" disabled>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ชื่อ-นามสกุล</label>
                            <input type="text" name="teacherName" value="${teacher.name}" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">อีเมล</label>
                            <input type="email" name="email" value="${teacher.email || ''}" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รหัสผ่านใหม่ (เว้นว่างหากไม่ต้องการเปลี่ยน)</label>
                            <input type="password" name="newPassword" placeholder="เว้นว่างหากไม่ต้องการเปลี่ยน" class="w-full px-4 py-2 border rounded-lg">
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">กลุ่มสาระฯ</label>
                            <select name="department" class="w-full px-4 py-2 border rounded-lg" required>
                                ${departmentOptions}
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ตำแหน่ง</label>
                            <select name="position" class="w-full px-4 py-2 border rounded-lg" required>
                                <option value="ครูผู้สอน" ${teacher.position === 'ครูผู้สอน' ? 'selected' : ''}>ครูผู้สอน</option>
                                <option value="หัวหน้ากลุ่มสาระฯ" ${teacher.position === 'หัวหน้ากลุ่มสาระฯ' ? 'selected' : ''}>หัวหน้ากลุ่มสาระฯ</option>
                            </select>
                        </div>
                    </form>
                `,
                showCancelButton: true,
                confirmButtonText: 'บันทึก',
                cancelButtonText: 'ยกเลิก',
                preConfirm: () => {
                    const form = document.getElementById('editTeacherForm');
                    return {
                        teacherName: form.teacherName.value,
                        email: form.email.value,
                        department: form.department.value,
                        position: form.position.value,
                        newPassword: form.newPassword.value
                    };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(async () => {
                        teacher.name = result.value.teacherName;
                        teacher.email = result.value.email;
                        teacher.department = result.value.department;
                        teacher.position = result.value.position;
                        
                        // Sync name to user account too
                        const user = systemData.users.find(u => u.teacherId === teacherId);
                        if (user) {
                            user.name = result.value.teacherName;
                            user.email = result.value.email;
                            if (result.value.newPassword) {
                                user.password = await hashPassword(result.value.newPassword);
                            }
                        }

                        saveSystemData(systemData);
                        loadTeacherManagement();
                        Swal.fire('สำเร็จ', 'แก้ไขข้อมูลเรียบร้อย', 'success');
                        hideLoading();
                    }, 500);
                }
            });
        }

        function resetTeacherPassword(teacherId) {
            const teacher = systemData.teachers.find(t => t.id === teacherId);
            const user = systemData.users.find(u => u.teacherId === teacherId);

            if (!user) {
                Swal.fire('ไม่พบบัญชี', 'ไม่พบบัญชีผู้ใช้สำหรับครูท่านนี้', 'error');
                return;
            }

            Swal.fire({
                title: 'รีเซ็ตรหัสผ่าน?',
                html: `คุณต้องการรีเซ็ตรหัสผ่านของ <strong>${teacher.name}</strong> หรือไม่?<br>รหัสผ่านจะถูกเปลี่ยนเป็น: <strong>${user.id}</strong>`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'รีเซ็ต',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#ef4444'
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(async () => {
                        user.password = await hashPassword(user.id); // Reset password to teacher ID
                        saveSystemData(systemData);
                        hideLoading();
                        Swal.fire('สำเร็จ', `รหัสผ่านของ ${teacher.name} ถูกรีเซ็ตเรียบร้อยแล้ว`, 'success');
                    }, 500);
                }
            });
        }

        function deleteTeacher(teacherId) {
            Swal.fire({
                title: 'ลบบุคลากร?',
                text: 'คุณต้องการลบบุคลากรนี้หรือไม่?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'ลบ',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#ef4444'
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(() => {
                        systemData.teachers = systemData.teachers.filter(t => t.id !== teacherId);
                        systemData.submissions = systemData.submissions.filter(s => s.teacherId !== teacherId);
                        systemData.users = systemData.users.filter(u => u.teacherId !== teacherId);
                        saveSystemData(systemData);
                        loadTeacherManagement();
                        Swal.fire('สำเร็จ', 'ลบบุคลากรเรียบร้อย', 'success');
                        hideLoading();
                    }, 500);
                }
            });
        }

        // System sync callback
        window.onSystemDataSynced = function(data) {
            loadTeacherManagement();
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

            loadTeacherManagement();
        });