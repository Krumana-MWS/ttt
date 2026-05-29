// Set system synced hook to refresh UI when Google Sheets data updates
        window.onSystemDataSynced = function(data) {
            renderAssignmentsTable();
        };

        // Assignment Management
        function loadAssignmentManagement() {
            loadAssignmentWorkGroupFilters();
            renderAssignmentsTable();
            setupAssignmentManagementFilters();
        }

        function loadAssignmentWorkGroupFilters() {
            const workGroups = systemData.workGroups.filter(wg => wg.status === 'ใช้งาน');
            const filterWorkGroup = document.getElementById('filterAssignmentWorkGroup');
            if (!filterWorkGroup) return;
            // Keep the first option and clear the rest
            while (filterWorkGroup.options.length > 1) {
                filterWorkGroup.remove(1);
            }
            workGroups.forEach(wg => {
                const option = document.createElement('option');
                option.value = wg.id;
                option.textContent = wg.name;
                filterWorkGroup.appendChild(option);
            });
        }

        function renderAssignmentsTable(filters = {}) {
            const tbody = document.getElementById('assignmentsTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            let assignments = systemData.assignments || [];

            // Filter for Head of Department
            if (currentUser.role === 'head') {
                const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
                if (headTeacher) {
                    const departmentTeachers = systemData.teachers
                        .filter(t => t.department === headTeacher.department)
                        .map(t => t.id);
                    
                    assignments = assignments.filter(a => 
                        a.assignedTeachers.some(tid => departmentTeachers.includes(tid))
                    );
                }
            }

            // Apply search and filter
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                assignments = assignments.filter(a => a.name.toLowerCase().includes(searchTerm));
            }

            if (filters.workGroup) {
                assignments = assignments.filter(a => a.workGroupId === filters.workGroup);
            }

            if (assignments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">ไม่พบข้อมูล</td></tr>';
                return;
            }

            assignments.forEach(assignment => {
                const workGroup = systemData.workGroups.find(wg => wg.id === assignment.workGroupId);
                const workGroupName = workGroup ? workGroup.name : 'ไม่ระบุ';

                const row = document.createElement('tr');
                row.className = 'border-b hover:bg-gray-50';
                row.innerHTML = `
                    <td class="px-6 py-4">${assignment.id}</td>
                    <td class="px-6 py-4">${assignment.name}</td>
                    <td class="px-6 py-4">${workGroupName}</td>
                    <td class="px-6 py-4">${formatThaiDate(assignment.dueDate)}</td>
                    <td class="px-6 py-4">${assignment.assignedTeachers.length} คน</td>
                    <td class="px-6 py-4">
                        <button onclick="viewAssignment('${assignment.id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="ดูรายละเอียด"><i class="fas fa-eye"></i></button>                        
                        ${assignment.attachment ? `<button onclick="downloadAttachment('${assignment.id}')" class="text-sky-600 hover:text-sky-800 mr-2" title="ดาวน์โหลดไฟล์แนบ"><i class="fas fa-download"></i></button>` : ''}
                        ${currentUser.role === 'admin' || (currentUser.role === 'head' && (assignment.createdBy === (currentUser.teacherId || currentUser.id) || (workGroup && workGroup.leaderId === currentUser.teacherId))) ? `
                            <button onclick="showDuplicateAssignmentModal('${assignment.id}')" class="text-purple-600 hover:text-purple-800 mr-2" title="คัดลอก"><i class="fas fa-copy"></i></button>
                            <button onclick="editAssignment('${assignment.id}')" class="text-green-600 hover:text-green-800 mr-2" title="แก้ไข"><i class="fas fa-edit"></i></button>
                            <button onclick="deleteAssignment('${assignment.id}')" class="text-red-600 hover:text-red-800" title="ลบ"><i class="fas fa-trash"></i></button>                            
                        ` : ''}
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
        
        function setupAssignmentManagementFilters() {
            const searchInput = document.getElementById('searchAssignmentInput');
            const workGroupFilter = document.getElementById('filterAssignmentWorkGroup');
            if (!searchInput || !workGroupFilter) return;

            const applyFilters = () => {
                const filters = {
                    search: searchInput.value,
                    workGroup: workGroupFilter.value
                };
                renderAssignmentsTable(filters);
            };

            searchInput.addEventListener('input', applyFilters);
            workGroupFilter.addEventListener('change', applyFilters);
        }

        const COMMON_FILE_TYPES = [
            { ext: 'pdf', label: 'PDF' },
            { ext: 'doc', label: 'DOC' },
            { ext: 'docx', label: 'DOCX' },
            { ext: 'xls', label: 'XLS' },
            { ext: 'xlsx', label: 'XLSX' },
            { ext: 'ppt', label: 'PPT' },
            { ext: 'pptx', label: 'PPTX' },
            { ext: 'jpg', label: 'JPG' },
            { ext: 'png', label: 'PNG' },
            { ext: 'zip', label: 'ZIP' },
        ];

        function createAssignmentFromModal(value) {
            showLoading();
            setTimeout(() => {
                const newAssignment = {
                    id: value.assignmentId,
                    name: value.assignmentName,
                    workGroupId: value.workGroupId,
                    dueDate: value.dueDate,
                    description: value.description,
                    assignedTeachers: value.selectedTeachers,
                    createdBy: currentUser.teacherId || currentUser.id,
                    fileRequirements: value.fileRequirements,
                    attachment: value.attachment,
                    allowTextSubmission: value.allowTextSubmission || false,
                    requireTextSubmission: value.requireTextSubmission || false
                };
                systemData.assignments.push(newAssignment);

                value.selectedTeachers.forEach(teacherId => {
                    const submissionId = 'S' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                    systemData.submissions.push({
                        id: submissionId,
                        assignmentId: newAssignment.id,
                        teacherId: teacherId,
                        status: 'ยังไม่ส่ง',
                        submissionDate: null,
                        files: [],
                        feedback: ''
                    });
                });
                
                value.selectedTeachers.forEach(teacherId => {
                    createNotification(teacherId, `คุณได้รับมอบหมายงานใหม่: ${newAssignment.name}`, 'new_assignment', 'my-tasks.html');
                    if (typeof sendEmailNotification === 'function') {
                        sendEmailNotification(teacherId, `ได้รับมอบหมายงานใหม่: ${newAssignment.name}`, `เรียนคุณครู,\n\nคุณได้รับมอบหมายงานใหม่ "${newAssignment.name}" กำหนดส่งวันที่ ${formatThaiDate(newAssignment.dueDate)}\n\nกรุณาเข้าสู่ระบบเพื่อตรวจสอบรายละเอียดและส่งงาน\n\nขอบคุณครับ`);
                    }
                });

                saveSystemData(systemData);
                loadAssignmentManagement();
                Swal.fire('สำเร็จ', 'สร้างงานเรียบร้อย', 'success');
                hideLoading();
            }, 500);
        }

        function showAddAssignmentModal() {
            let availableWorkGroups = systemData.workGroups.filter(wg => wg.status === 'ใช้งาน');
            
            if (availableWorkGroups.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'ไม่สามารถสร้างงานได้',
                    text: 'ไม่มีกลุ่มงานที่ใช้งานได้'
                });
                return;
            }

            const workGroupOptions = availableWorkGroups.map(wg => 
                `<option value="${wg.id}">${wg.name}</option>`
            ).join('');

            let teachers = systemData.teachers;
            if (currentUser.role === 'head') {
                const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
                if (headTeacher) {
                    teachers = teachers.filter(t => t.department === headTeacher.department);
                }
            }

            const teacherCheckboxes = teachers.map(t => 
                `<label class="flex items-center mb-2">
                    <input type="checkbox" name="teachers" value="${t.id}" class="mr-2">
                    ${t.name} (${t.department})
                </label>`
            ).join('');

            const fileTypeCheckboxes = COMMON_FILE_TYPES.map(type => `
                <label class="flex items-center text-sm">
                    <input type="checkbox" name="allowedTypes" value="${type.ext}" class="mr-2">
                    ${type.label}
                </label>
            `).join('');

            Swal.fire({
                title: 'สร้างงานใหม่',
                html: `
                    <form id="addAssignmentForm" class="text-left">
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ชื่องาน</label>
                            <input type="text" name="assignmentName" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">กลุ่มงาน</label>
                            <select name="workGroupId" class="w-full px-4 py-2 border rounded-lg" required>
                                <option value="">เลือกกลุ่มงาน</option>
                                ${workGroupOptions}
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">กำหนดส่ง</label>
                            <input type="date" name="dueDate" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รายละเอียด</label>
                            <textarea name="description" class="w-full px-4 py-2 border rounded-lg" rows="3" required></textarea>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">แนบไฟล์คำสั่ง/ตัวอย่าง (ถ้ามี)</label>
                            <input type="file" name="attachment" class="w-full text-sm">
                            <p class="text-xs text-gray-500 mt-1">ระบบนี้เป็น Demo ไม่สามารถอัปโหลดไฟล์จริงได้</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div class="col-span-2">
                                <label class="block text-gray-700 font-semibold mb-2">ประเภทไฟล์ที่อนุญาต</label>
                                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 p-3 border rounded-lg">${fileTypeCheckboxes}</div>
                                <p class="text-xs text-gray-500 mt-1">หากไม่เลือก จะถือว่าอนุญาตทุกประเภท</p>
                            </div>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">จำนวนไฟล์สูงสุด</label>
                                <input type="number" name="maxFiles" value="1" min="1" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ตัวเลือกการส่งงานเพิ่มเติม</label>
                            <label class="flex items-center text-sm text-gray-700 mb-1 cursor-pointer">
                                <input type="checkbox" id="allowTextSubmission" onchange="document.getElementById('requireTextContainer').style.display = this.checked ? 'block' : 'none'" class="mr-2">
                                อนุญาตให้ผู้ส่งงานพิมพ์รายละเอียดเพิ่มเติมได้
                            </label>
                            <div id="requireTextContainer" style="display: none;" class="pl-6 mt-1">
                                <label class="flex items-center text-sm text-gray-600 cursor-pointer">
                                    <input type="checkbox" id="requireTextSubmission" class="mr-2">
                                    บังคับให้ต้องพิมพ์รายละเอียด (ห้ามเว้นว่าง)
                                </label>
                            </div>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">มอบหมายให้</label>
                            <div class="max-h-48 overflow-y-auto border rounded-lg p-3">
                                ${teacherCheckboxes}
                            </div>
                        </div>
                    </form>
                `,
                width: '600px',
                showCancelButton: true,
                confirmButtonText: 'สร้าง',
                cancelButtonText: 'ยกเลิก',
                preConfirm: () => {
                    const form = document.getElementById('addAssignmentForm');
                    const assignmentName = form.assignmentName.value;
                    const workGroupId = form.workGroupId.value;
                    const dueDate = form.dueDate.value;
                    const description = form.description.value;
                    const selectedTeachers = Array.from(form.querySelectorAll('input[name="teachers"]:checked')).map(cb => cb.value);
                    const allowedTypes = Array.from(form.querySelectorAll('input[name="allowedTypes"]:checked')).map(cb => cb.value);
                    const maxFiles = parseInt(form.maxFiles.value, 10) || 1;
                    const attachmentFile = form.attachment.files[0];
                    const allowTextSubmission = document.getElementById('allowTextSubmission').checked;
                    const requireTextSubmission = allowTextSubmission ? document.getElementById('requireTextSubmission').checked : false;
                    
                    // Generate new assignment ID
                    const lastIdNum = systemData.assignments.reduce((maxId, a) => {
                        const currentIdNum = parseInt(a.id.substring(1), 10);
                        return currentIdNum > maxId ? currentIdNum : maxId;
                    }, 0);
                    const newAssignmentId = 'A' + (lastIdNum + 1).toString().padStart(3, '0');

                    if (!assignmentName || !workGroupId || !dueDate || !description) {
                        Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                        return false;
                    }
                    if (selectedTeachers.length === 0) {
                        Swal.showValidationMessage('กรุณาเลือกครูอย่างน้อย 1 คน');
                        return false;
                    }

                    return { 
                        assignmentId: newAssignmentId, 
                        assignmentName, workGroupId, dueDate, description, selectedTeachers, 
                        fileRequirements: { allowedTypes, maxFiles },
                        attachment: attachmentFile ? { name: attachmentFile.name } : null,
                        allowTextSubmission,
                        requireTextSubmission
                    };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    createAssignmentFromModal(result.value);
                }
            });
        }

        function viewAssignment(assignmentId) {
            const assignment = systemData.assignments.find(a => a.id === assignmentId);
            if (!assignment) return;

            const workGroup = systemData.workGroups.find(wg => wg.id === assignment.workGroupId);
            const workGroupName = workGroup ? workGroup.name : 'ไม่ระบุ';

            const assignedTeachers = assignment.assignedTeachers
                .map(tid => {
                    const teacher = systemData.teachers.find(t => t.id === tid);
                    return teacher ? teacher.name : tid;
                })
                .join(', ');

            Swal.fire({
                title: 'รายละเอียดงาน',
                html: `
                    <div class="text-left">
                        <h3 class="text-xl font-bold mb-4">${assignment.name}</h3>
                        <p class="mb-2"><strong>กลุ่มงาน:</strong> ${workGroupName}</p>
                        <p class="mb-2"><strong>กำหนดส่ง:</strong> ${formatThaiDate(assignment.dueDate)}</p>
                        <p class="mb-2"><strong>ไฟล์ที่ต้องการ:</strong> ${assignment.fileRequirements.maxFiles} ไฟล์ (${assignment.fileRequirements.allowedTypes.join(', ').toUpperCase() || 'ทุกประเภท'})</p>
                        <p class="mb-2"><strong>รายละเอียด:</strong> ${assignment.description}</p>
                        <p class="mb-2"><strong>ไฟล์แนบ:</strong> ${assignment.attachment ? assignment.attachment.name : 'ไม่มี'}</p>
                        <p class="mb-2"><strong>มอบหมายให้:</strong> ${assignedTeachers}</p>
                    </div>
                `,
                icon: 'info'
            });
        }

        function editAssignment(assignmentId) {
            const assignment = systemData.assignments.find(a => a.id === assignmentId);
            if (!assignment) return;

            const fileReqs = assignment.fileRequirements || { allowedTypes: [], maxFiles: 1 };

            let teachers = systemData.teachers;
            if (currentUser.role === 'head') {
                const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
                if (headTeacher) {
                    teachers = teachers.filter(t => t.department === headTeacher.department || assignment.assignedTeachers.includes(t.id));
                }
            }

            const teacherCheckboxes = teachers.map(t => 
                `<label class="flex items-center mb-2">
                    <input type="checkbox" name="teachers" value="${t.id}" ${assignment.assignedTeachers.includes(t.id) ? 'checked' : ''} class="mr-2">
                    ${t.name} (${t.department})
                </label>`
            ).join('');

            const fileTypeCheckboxes = COMMON_FILE_TYPES.map(type => `
                <label class="flex items-center text-sm">
                    <input type="checkbox" name="allowedTypes" value="${type.ext}" ${fileReqs.allowedTypes.includes(type.ext) ? 'checked' : ''} class="mr-2">
                    ${type.label}
                </label>
            `).join('');

            Swal.fire({
                title: 'แก้ไขงาน',
                html: `
                    <form id="editAssignmentForm" class="text-left">
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รหัสงาน</label>
                            <input type="text" value="${assignment.id}" class="w-full px-4 py-2 border rounded-lg bg-gray-100" disabled>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ชื่องาน</label>
                            <input type="text" name="assignmentName" value="${assignment.name}" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">กำหนดส่ง</label>
                            <input type="date" name="dueDate" value="${assignment.dueDate}" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รายละเอียด</label>
                            <textarea name="description" class="w-full px-4 py-2 border rounded-lg" rows="3" required>${assignment.description}</textarea>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ไฟล์แนบ (ถ้ามี)</label>
                            <input type="file" name="attachment" class="w-full text-sm">
                            ${assignment.attachment ? `<p class="text-xs text-gray-500 mt-1">ไฟล์ปัจจุบัน: ${assignment.attachment.name} (การเลือกไฟล์ใหม่จะแทนที่ไฟล์เดิม)</p>` : ''}
                        </div>
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div class="col-span-2">
                                <label class="block text-gray-700 font-semibold mb-2">ประเภทไฟล์ที่อนุญาต</label>
                                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 p-3 border rounded-lg">${fileTypeCheckboxes}</div>
                                <p class="text-xs text-gray-500 mt-1">หากไม่เลือก จะถือว่าอนุญาตทุกประเภท</p>
                            </div>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">จำนวนไฟล์สูงสุด</label>
                                <input type="number" name="maxFiles" value="${fileReqs.maxFiles}" min="1" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ตัวเลือกการส่งงานเพิ่มเติม</label>
                            <label class="flex items-center text-sm text-gray-700 mb-1 cursor-pointer">
                                <input type="checkbox" id="allowTextSubmission" onchange="document.getElementById('requireTextContainerEdit').style.display = this.checked ? 'block' : 'none'" ${assignment.allowTextSubmission ? 'checked' : ''} class="mr-2">
                                อนุญาตให้ผู้ส่งงานพิมพ์รายละเอียดเพิ่มเติมได้
                            </label>
                            <div id="requireTextContainerEdit" style="display: ${assignment.allowTextSubmission ? 'block' : 'none'};" class="pl-6 mt-1">
                                <label class="flex items-center text-sm text-gray-600 cursor-pointer">
                                    <input type="checkbox" id="requireTextSubmission" ${assignment.requireTextSubmission ? 'checked' : ''} class="mr-2">
                                    บังคับให้ต้องพิมพ์รายละเอียด (ห้ามเว้นว่าง)
                                </label>
                            </div>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">มอบหมายให้</label>
                            <div class="max-h-48 overflow-y-auto border rounded-lg p-3">
                                ${teacherCheckboxes}
                            </div>
                        </div>
                    </form>
                `,
                width: '600px',
                showCancelButton: true,
                confirmButtonText: 'บันทึก',
                cancelButtonText: 'ยกเลิก',
                preConfirm: () => {
                    const form = document.getElementById('editAssignmentForm');
                    const selectedTeachers = Array.from(form.querySelectorAll('input[name="teachers"]:checked')).map(cb => cb.value);
                    const allowedTypes = Array.from(form.querySelectorAll('input[name="allowedTypes"]:checked')).map(cb => cb.value);
                    const maxFiles = parseInt(form.maxFiles.value, 10) || 1;
                    const attachmentFile = form.attachment.files[0];
                    const allowTextSubmission = document.getElementById('allowTextSubmission').checked;
                    const requireTextSubmission = allowTextSubmission ? document.getElementById('requireTextSubmission').checked : false;

                    if (selectedTeachers.length === 0) {
                        Swal.showValidationMessage('กรุณาเลือกครูอย่างน้อย 1 คน');
                        return false;
                    }

                    return {
                        assignmentName: form.assignmentName.value,
                        dueDate: form.dueDate.value,
                        description: form.description.value,
                        selectedTeachers: selectedTeachers,
                        fileRequirements: { allowedTypes, maxFiles },
                        attachment: attachmentFile ? { name: attachmentFile.name } : assignment.attachment,
                        allowTextSubmission,
                        requireTextSubmission
                    };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(() => {
                        assignment.name = result.value.assignmentName;
                        assignment.dueDate = result.value.dueDate;
                        assignment.description = result.value.description;
                        assignment.fileRequirements = result.value.fileRequirements;
                        assignment.attachment = result.value.attachment;
                        assignment.allowTextSubmission = result.value.allowTextSubmission;
                        assignment.requireTextSubmission = result.value.requireTextSubmission;

                        const removedTeachers = assignment.assignedTeachers.filter(tid => !result.value.selectedTeachers.includes(tid));
                        removedTeachers.forEach(tid => {
                            systemData.submissions = systemData.submissions.filter(s => 
                                !(s.assignmentId === assignment.id && s.teacherId === tid)
                            );
                        });

                        const newTeachers = result.value.selectedTeachers.filter(tid => !assignment.assignedTeachers.includes(tid));
                        newTeachers.forEach(tid => {
                            const submissionId = 'S' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                            systemData.submissions.push({
                                id: submissionId,
                                assignmentId: assignment.id,
                                teacherId: tid,
                                status: 'ยังไม่ส่ง',
                                submissionDate: null,
                                files: [],
                                feedback: ''
                            });
                        });
                        
                        newTeachers.forEach(tid => {
                            createNotification(tid, `คุณได้รับมอบหมายงานใหม่: ${assignment.name}`, 'new_assignment', 'my-tasks.html');
                            if (typeof sendEmailNotification === 'function') {
                                sendEmailNotification(tid, `ได้รับมอบหมายงานใหม่: ${assignment.name}`, `เรียนคุณครู,\n\nคุณได้รับมอบหมายงานใหม่ "${assignment.name}" กำหนดส่งวันที่ ${formatThaiDate(assignment.dueDate)}\n\nกรุณาเข้าสู่ระบบเพื่อตรวจสอบรายละเอียดและส่งงาน\n\nขอบคุณครับ`);
                            }
                        });

                        assignment.assignedTeachers = result.value.selectedTeachers;
                        saveSystemData(systemData);
                        loadAssignmentManagement();
                        Swal.fire('สำเร็จ', 'แก้ไขงานเรียบร้อย', 'success');
                        hideLoading();
                    }, 500);
                }
            });
        }

        function showDuplicateAssignmentModal(assignmentId) {
            const originalAssignment = systemData.assignments.find(a => a.id === assignmentId);
            if (!originalAssignment) return;

            const fileReqs = originalAssignment.fileRequirements || { allowedTypes: [], maxFiles: 1 };

            let availableWorkGroups = systemData.workGroups.filter(wg => wg.status === 'ใช้งาน');
            const workGroupOptions = availableWorkGroups.map(wg => 
                `<option value="${wg.id}" ${wg.id === originalAssignment.workGroupId ? 'selected' : ''}>${wg.name}</option>`
            ).join('');

            let teachers = systemData.teachers;
            if (currentUser.role === 'head') {
                const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
                if (headTeacher) {
                    teachers = teachers.filter(t => t.department === headTeacher.department || originalAssignment.assignedTeachers.includes(t.id));
                }
            }

            const teacherCheckboxes = teachers.map(t => 
                `<label class="flex items-center mb-2">
                    <input type="checkbox" name="teachers" value="${t.id}" ${originalAssignment.assignedTeachers.includes(t.id) ? 'checked' : ''} class="mr-2">
                    ${t.name} (${t.department})
                </label>`
            ).join('');

            const fileTypeCheckboxes = COMMON_FILE_TYPES.map(type => `
                <label class="flex items-center text-sm">
                    <input type="checkbox" name="allowedTypes" value="${type.ext}" ${fileReqs.allowedTypes.includes(type.ext) ? 'checked' : ''} class="mr-2">
                    ${type.label}
                </label>
            `).join('');

            Swal.fire({
                title: 'คัดลอกงาน',
                html: `
                    <form id="duplicateAssignmentForm" class="text-left">
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ชื่องาน</label>
                            <input type="text" name="assignmentName" value="สำเนาของ ${originalAssignment.name}" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">กลุ่มงาน</label>
                            <select name="workGroupId" class="w-full px-4 py-2 border rounded-lg" required>
                                ${workGroupOptions}
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">กำหนดส่ง</label>
                            <input type="date" name="dueDate" class="w-full px-4 py-2 border rounded-lg" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">รายละเอียด</label>
                            <textarea name="description" class="w-full px-4 py-2 border rounded-lg" rows="3" required>${originalAssignment.description}</textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div class="col-span-2">
                                <label class="block text-gray-700 font-semibold mb-2">ประเภทไฟล์ที่อนุญาต</label>
                                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 p-3 border rounded-lg">${fileTypeCheckboxes}</div>
                            </div>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">จำนวนไฟล์สูงสุด</label>
                                <input type="number" name="maxFiles" value="${fileReqs.maxFiles}" min="1" class="w-full px-4 py-2 border rounded-lg" required>
                            </div>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">ตัวเลือกการส่งงานเพิ่มเติม</label>
                            <label class="flex items-center text-sm text-gray-700 mb-1 cursor-pointer">
                                <input type="checkbox" id="allowTextSubmission" onchange="document.getElementById('requireTextContainerDup').style.display = this.checked ? 'block' : 'none'" ${originalAssignment.allowTextSubmission ? 'checked' : ''} class="mr-2">
                                อนุญาตให้ผู้ส่งงานพิมพ์รายละเอียดเพิ่มเติมได้
                            </label>
                            <div id="requireTextContainerDup" style="display: ${originalAssignment.allowTextSubmission ? 'block' : 'none'};" class="pl-6 mt-1">
                                <label class="flex items-center text-sm text-gray-600 cursor-pointer">
                                    <input type="checkbox" id="requireTextSubmission" ${originalAssignment.requireTextSubmission ? 'checked' : ''} class="mr-2">
                                    บังคับให้ต้องพิมพ์รายละเอียด (ห้ามเว้นว่าง)
                                </label>
                            </div>
                        </div>
                        <div class="mb-4">
                            <label class="block text-gray-700 font-semibold mb-2">มอบหมายให้</label>
                            <div class="max-h-48 overflow-y-auto border rounded-lg p-3">${teacherCheckboxes}</div>
                        </div>
                    </form>
                `,
                width: '600px',
                showCancelButton: true,
                confirmButtonText: 'สร้างงานใหม่',
                cancelButtonText: 'ยกเลิก',
                preConfirm: () => {
                    const form = document.getElementById('duplicateAssignmentForm');
                    const assignmentName = form.assignmentName.value;
                    const workGroupId = form.workGroupId.value;
                    const dueDate = form.dueDate.value;
                    const description = form.description.value;
                    const selectedTeachers = Array.from(form.querySelectorAll('input[name="teachers"]:checked')).map(cb => cb.value);
                    const allowedTypes = Array.from(form.querySelectorAll('input[name="allowedTypes"]:checked')).map(cb => cb.value);
                    const maxFiles = parseInt(form.maxFiles.value, 10) || 1;
                    const allowTextSubmission = document.getElementById('allowTextSubmission').checked;
                    const requireTextSubmission = allowTextSubmission ? document.getElementById('requireTextSubmission').checked : false;

                    // Generate new assignment ID
                    const lastIdNum = systemData.assignments.reduce((maxId, a) => {
                        const currentIdNum = parseInt(a.id.substring(1), 10);
                        return currentIdNum > maxId ? currentIdNum : maxId;
                    }, 0);
                    const newAssignmentId = 'A' + (lastIdNum + 1).toString().padStart(3, '0');

                    if (!assignmentName || !workGroupId || !dueDate || !description) {
                        Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                        return false;
                    }
                    if (selectedTeachers.length === 0) {
                        Swal.showValidationMessage('กรุณาเลือกครูอย่างน้อย 1 คน');
                        return false;
                    }

                    return { 
                        assignmentId: newAssignmentId,
                        assignmentName, workGroupId, dueDate, description, selectedTeachers, 
                        fileRequirements: { allowedTypes, maxFiles },
                        attachment: originalAssignment.attachment,
                        allowTextSubmission,
                        requireTextSubmission
                    };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    createAssignmentFromModal(result.value);
                }
            });
        }

        function downloadAttachment(assignmentId) {
            const assignment = systemData.assignments.find(a => a.id === assignmentId);
            if (assignment && assignment.attachment) {
                Swal.fire({
                    title: 'ดาวน์โหลดไฟล์แนบ',
                    text: `ระบบจะเริ่มดาวน์โหลดไฟล์ "${assignment.attachment.name}" (นี่เป็นเพียงการจำลอง)`,
                    icon: 'info'
                });
            }
        }

        function deleteAssignment(assignmentId) {
            Swal.fire({
                title: 'ลบงาน?',
                text: 'คุณต้องการลบงานนี้หรือไม่? การส่งงานทั้งหมดจะถูกลบด้วย',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'ลบ',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#ef4444'
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(() => {
                        systemData.assignments = systemData.assignments.filter(a => a.id !== assignmentId);
                        systemData.submissions = systemData.submissions.filter(s => s.assignmentId !== assignmentId);
                        saveSystemData(systemData);
                        loadAssignmentManagement();
                        Swal.fire('สำเร็จ', 'ลบงานเรียบร้อย', 'success');
                        hideLoading();
                    }, 500);
                }
            });
        }

        // Loading Overlay
        function showLoading() {
            document.getElementById('loadingOverlay').classList.add('active');
        }

        function hideLoading() {
            document.getElementById('loadingOverlay').classList.remove('active');
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            currentUser = getCurrentUser();
            if (!currentUser) {
                window.location.href = 'index.html';
                return;
            }

            // Check access rights for admin/head pages
            const restrictedPages = ['dashboard.html', 'assignment-management.html'];
            const pageName = window.location.pathname.split('/').pop();
            if (restrictedPages.includes(pageName) && currentUser.role === 'teacher') {
                 window.location.href = 'my-tasks.html'; // Redirect teacher away
                 return;
            }

            // Check access rights for admin only pages
            const adminOnlyPages = ['teacher-management.html', 'department-management.html', 'work-group-management.html', 'system-settings.html'];
             if (adminOnlyPages.includes(pageName) && currentUser.role !== 'admin') {
                 window.location.href = 'dashboard.html'; // Redirect non-admin away
                 return;
            }

            applySystemSettings();
            document.getElementById('currentUserName').textContent = currentUser.name;
            document.getElementById('currentUserRole').textContent = getRoleText(currentUser.role);
            if(typeof initSidebar === 'function') initSidebar();
            updateNotificationUI();
            loadAssignmentManagement();
        });

        // Background Google Apps Script sync callback
        window.onSystemDataSynced = function(syncedData) {
            systemData = syncedData;
            loadAssignmentManagement();
        };