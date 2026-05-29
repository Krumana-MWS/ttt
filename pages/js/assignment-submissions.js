// Assignment Submissions Javascript Module
let currentAuditAssignmentId = null;

// Helper to determine the real overdue status of a submission
function getDetailedStatus(submission, assignment) {
    if (!assignment) return submission.status;
    if (submission.status === 'ยังไม่ส่ง' && new Date(assignment.dueDate) < new Date()) {
        return 'เกินกำหนด';
    }
    return submission.status;
}

// Access Control & Setup
document.addEventListener('DOMContentLoaded', () => {
    currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = '../index.html';
        return;
    }

    // Check access rights: only admin and head are allowed
    if (currentUser.role !== 'admin' && currentUser.role !== 'head') {
        window.location.href = 'my-tasks.html';
        return;
    }

    applySystemSettings();
    initPage();
    setupEventHandlers();
});

// Sync data hook from GAS background
window.onSystemDataSynced = function (syncedData) {
    systemData = syncedData;
    initPage();
    if (currentAuditAssignmentId) {
        refreshAuditModal();
    }
};

function initPage() {
    loadWorkGroupOptions();
    loadDepartmentOptions();
    calculateOverallStats();
    renderAssignmentsTable();
}

// Fetch active work groups and populate dropdown
function loadWorkGroupOptions() {
    const filterWorkGroup = document.getElementById('filterWorkGroup');
    if (!filterWorkGroup) return;

    const workGroups = (systemData.workGroups || []).filter(wg => wg.status === 'ใช้งาน');
    filterWorkGroup.innerHTML = '<option value="">ทุกกลุ่มงาน</option>';
    workGroups.forEach(wg => {
        filterWorkGroup.innerHTML += `<option value="${wg.id}">${wg.name}</option>`;
    });
}

// Populate the Department Filter dropdown
function loadDepartmentOptions() {
    const filterDept = document.getElementById('filterDept');
    if (!filterDept) return;

    // Head of Department: lock to their own department
    if (currentUser.role === 'head') {
        const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
        const deptName = headTeacher ? headTeacher.department : '';
        filterDept.innerHTML = `<option value="${deptName}">${deptName}</option>`;
        filterDept.disabled = true;
        filterDept.classList.add('bg-gray-100', 'text-gray-500', 'cursor-not-allowed');
        return;
    }

    // Admin: show all active departments
    const departments = (systemData.departments || []).filter(d => d.status === 'ใช้งาน').map(d => d.name);
    filterDept.innerHTML = '<option value="">ทุกกลุ่มสาระการเรียนรู้</option>';
    departments.forEach(dept => {
        filterDept.innerHTML += `<option value="${dept}">${dept}</option>`;
    });
}

// Get teachers filtered by department if Head of Department
function getTargetTeachers() {
    let teachers = systemData.teachers || [];
    if (currentUser.role === 'head') {
        const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
        if (headTeacher) {
            teachers = teachers.filter(t => t.department === headTeacher.department);
        }
    }
    return teachers;
}

// Calculate top stats cards
function calculateOverallStats() {
    let assignments = systemData.assignments || [];
    const targetTeachers = getTargetTeachers();
    const targetTeacherIds = targetTeachers.map(t => t.id);

    // If Head: Filter assignments to only those that have at least one teacher from their department assigned
    if (currentUser.role === 'head') {
        assignments = assignments.filter(a => 
            (a.assignedTeachers || []).some(tid => targetTeacherIds.includes(tid))
        );
    }

    let total = assignments.length;
    let completedCount = 0;
    let pendingCount = 0;
    let incompleteCount = 0;

    assignments.forEach(assignment => {
        // Filter assigned teachers to only those relevant to current user's department scope
        const assignedTeachers = (assignment.assignedTeachers || []).filter(tid => targetTeacherIds.includes(tid));
        const totalAssigned = assignedTeachers.length;

        if (totalAssigned > 0) {
            const subs = systemData.submissions.filter(s => s.assignmentId === assignment.id && targetTeacherIds.includes(s.teacherId));
            const submitted = subs.filter(s => s.status === 'ส่งแล้ว').length;
            const pending = subs.filter(s => s.status === 'รอตรวจสอบ').length;

            if (submitted === totalAssigned) {
                completedCount++;
            } else if (pending > 0) {
                pendingCount++;
            } else {
                incompleteCount++;
            }
        }
    });

    document.getElementById('statTotalAssignments').textContent = total;
    document.getElementById('statCompletedAssignments').textContent = completedCount;
    document.getElementById('statPendingAssignments').textContent = pendingCount;
    document.getElementById('statIncompleteAssignments').textContent = incompleteCount;
}

// Render main table listing assignments
function renderAssignmentsTable() {
    const tbody = document.getElementById('assignmentsSubmissionsTableBody');
    const noDataView = document.getElementById('noDataView');
    if (!tbody) return;

    tbody.innerHTML = '';

    let assignments = systemData.assignments || [];
    const targetTeachers = getTargetTeachers();
    const targetTeacherIds = targetTeachers.map(t => t.id);

    // Filter assignments that are relevant to target teachers
    assignments = assignments.filter(a => 
        (a.assignedTeachers || []).some(tid => targetTeacherIds.includes(tid))
    );

    // Fetch filters
    const searchQuery = document.getElementById('searchAssignmentInput').value.toLowerCase().trim();
    const workGroupFilter = document.getElementById('filterWorkGroup').value;
    const deptFilter = document.getElementById('filterDept').value;
    const statusFilter = document.getElementById('filterStatus').value;
    const sortVal = document.getElementById('sortAssignments').value;

    // Apply Search filter
    if (searchQuery) {
        assignments = assignments.filter(a => a.name.toLowerCase().includes(searchQuery));
    }

    // Apply Work Group filter
    if (workGroupFilter) {
        assignments = assignments.filter(a => a.workGroupId === workGroupFilter);
    }

    // Calculate details and map to a helper list for filtering and sorting
    let mappedAssignments = assignments.map(assignment => {
        const workGroup = systemData.workGroups.find(wg => wg.id === assignment.workGroupId);
        const workGroupName = workGroup ? workGroup.name : 'ไม่ระบุ';

        // Filter assigned teachers based on Department Filter (Admin only) or Head's scope
        let assignedList = assignment.assignedTeachers || [];
        if (currentUser.role === 'head') {
            assignedList = assignedList.filter(tid => targetTeacherIds.includes(tid));
        } else if (currentUser.role === 'admin' && deptFilter) {
            const deptTeachers = systemData.teachers.filter(t => t.department === deptFilter).map(t => t.id);
            assignedList = assignedList.filter(tid => deptTeachers.includes(tid));
        }

        const totalAssigned = assignedList.length;

        // Fetch submissions for this assignment and specific teachers
        const subs = systemData.submissions.filter(s => s.assignmentId === assignment.id && assignedList.includes(s.teacherId));
        
        const submitted = subs.filter(s => s.status === 'ส่งแล้ว').length;
        const pending = subs.filter(s => s.status === 'รอตรวจสอบ').length;
        const rejected = subs.filter(s => s.status === 'ส่งแก้ไข').length;

        const overdue = subs.filter(s => {
            return s.status === 'ยังไม่ส่ง' && new Date(assignment.dueDate) < new Date();
        }).length;

        const notSubmitted = subs.filter(s => {
            return s.status === 'ยังไม่ส่ง' && new Date(assignment.dueDate) >= new Date();
        }).length;

        const progressPercent = totalAssigned > 0 ? Math.round((submitted / totalAssigned) * 100) : 0;

        return {
            assignment,
            workGroupName,
            totalAssigned,
            submitted,
            pending,
            rejected,
            overdue,
            notSubmitted,
            progressPercent
        };
    });

    // Remove assignments that ended up with 0 assigned teachers because of department filters
    mappedAssignments = mappedAssignments.filter(item => item.totalAssigned > 0);

    // Apply Status filter
    if (statusFilter === 'completed') {
        mappedAssignments = mappedAssignments.filter(item => item.progressPercent === 100);
    } else if (statusFilter === 'incomplete') {
        mappedAssignments = mappedAssignments.filter(item => item.progressPercent < 100);
    } else if (statusFilter === 'pending') {
        mappedAssignments = mappedAssignments.filter(item => item.pending > 0);
    }

    // Apply Sorting
    if (sortVal === 'dueDate-asc') {
        mappedAssignments.sort((a, b) => new Date(a.assignment.dueDate) - new Date(b.assignment.dueDate));
    } else if (sortVal === 'dueDate-desc') {
        mappedAssignments.sort((a, b) => new Date(b.assignment.dueDate) - new Date(a.assignment.dueDate));
    } else if (sortVal === 'name-asc') {
        mappedAssignments.sort((a, b) => a.assignment.name.localeCompare(b.assignment.name, 'th'));
    } else if (sortVal === 'progress-desc') {
        mappedAssignments.sort((a, b) => b.progressPercent - a.progressPercent);
    } else if (sortVal === 'progress-asc') {
        mappedAssignments.sort((a, b) => a.progressPercent - b.progressPercent);
    }

    // Hide or show noData view
    if (mappedAssignments.length === 0) {
        noDataView.classList.remove('hidden');
        return;
    } else {
        noDataView.classList.add('hidden');
    }

    mappedAssignments.forEach(item => {
        const a = item.assignment;
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-slate-50/50 transition duration-150 group';

        // Determine Progress Bar Color
        let barColor = 'bg-slate-300';
        if (item.totalAssigned > 0) {
            if (item.progressPercent === 100) {
                barColor = 'bg-emerald-500';
            } else if (item.progressPercent >= 50) {
                barColor = 'bg-indigo-500';
            } else if (item.overdue > 0) {
                barColor = 'bg-rose-500';
            } else {
                barColor = 'bg-yellow-500';
            }
        }

        row.innerHTML = `
            <td class="px-6 py-4 text-sm font-semibold text-slate-500 group-hover:text-slate-800 transition">${a.id}</td>
            <td class="px-6 py-4">
                <p class="font-bold text-slate-800 leading-snug">${a.name}</p>
                <p class="text-[10px] text-slate-400 font-medium mt-0.5">ผู้สร้าง: ${a.createdBy || 'ระบบ'}</p>
            </td>
            <td class="px-6 py-4 text-sm text-slate-600 font-semibold">${item.workGroupName}</td>
            <td class="px-6 py-4 text-sm text-slate-600 font-semibold">
                <i class="far fa-calendar-alt text-slate-400 mr-1.5"></i>${formatThaiDate(a.dueDate)}
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="progress-bar-container shadow-inner">
                        <div class="progress-bar-fill ${barColor}" style="width: ${item.progressPercent}%"></div>
                    </div>
                    <span class="text-sm font-bold text-slate-700 shrink-0 w-10 text-right">
                        ${item.progressPercent}%
                    </span>
                </div>
                <p class="text-xs text-slate-400 mt-1 font-medium">ส่งแล้ว ${item.submitted} / ${item.totalAssigned} คน</p>
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-wrap gap-1.5 max-w-xs">
                    ${item.submitted > 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">อนุมัติ ${item.submitted}</span>` : ''}
                    ${item.pending > 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-100 rounded-full animate-pulse">รอตรวจ ${item.pending}</span>` : ''}
                    ${item.overdue > 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 rounded-full">เกินกำหนด ${item.overdue}</span>` : ''}
                    ${item.rejected > 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 rounded-full">ส่งแก้ ${item.rejected}</span>` : ''}
                    ${item.notSubmitted > 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200 rounded-full">ค้างส่ง ${item.notSubmitted}</span>` : ''}
                </div>
            </td>
            <td class="px-6 py-4 text-center">
                <button onclick="openAuditModal('${a.id}')" class="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-bold transition shadow-sm border border-indigo-100 hover:border-indigo-600 flex items-center gap-1.5 mx-auto">
                    <i class="fas fa-search-plus"></i> ตรวจสอบ
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function setupEventHandlers() {
    const searchAssignmentInput = document.getElementById('searchAssignmentInput');
    const filterWorkGroup = document.getElementById('filterWorkGroup');
    const filterDept = document.getElementById('filterDept');
    const filterStatus = document.getElementById('filterStatus');
    const sortAssignments = document.getElementById('sortAssignments');

    const triggerRender = () => renderAssignmentsTable();

    if (searchAssignmentInput) searchAssignmentInput.addEventListener('input', triggerRender);
    if (filterWorkGroup) filterWorkGroup.addEventListener('change', triggerRender);
    if (filterDept) filterDept.addEventListener('change', triggerRender);
    if (filterStatus) filterStatus.addEventListener('change', triggerRender);
    if (sortAssignments) sortAssignments.addEventListener('change', triggerRender);
}

// Modal handling logic
function openAuditModal(assignmentId) {
    const assignment = systemData.assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    currentAuditAssignmentId = assignmentId;

    const workGroup = systemData.workGroups.find(wg => wg.id === assignment.workGroupId);
    const workGroupName = workGroup ? workGroup.name : 'ไม่ระบุ';

    // Load static values
    document.getElementById('modalAssignmentName').textContent = assignment.name;
    document.getElementById('modalAssignmentId').textContent = assignment.id;
    document.getElementById('modalAssignmentSubText').innerHTML = `<i class="fas fa-tags mr-1"></i>กลุ่มงาน: ${workGroupName} | <i class="far fa-calendar-alt mr-1"></i>กำหนดส่ง: ${formatThaiDate(assignment.dueDate)}`;

    refreshAuditModal();

    // Show modal smoothly
    const modal = document.getElementById('auditAssignmentModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock scrolling background
}

function closeAuditModal() {
    const modal = document.getElementById('auditAssignmentModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto'; // Unlock scrolling
    currentAuditAssignmentId = null;
}

// Re-calculate and render all contents inside the Modal
function refreshAuditModal() {
    if (!currentAuditAssignmentId) return;

    const assignment = systemData.assignments.find(a => a.id === currentAuditAssignmentId);
    if (!assignment) return;

    const targetTeachers = getTargetTeachers();
    const targetTeacherIds = targetTeachers.map(t => t.id);

    // Assigned teachers filter by department (if Head or Admin filter active)
    let assignedList = assignment.assignedTeachers || [];
    if (currentUser.role === 'head') {
        assignedList = assignedList.filter(tid => targetTeacherIds.includes(tid));
    } else {
        const deptFilter = document.getElementById('filterDept').value;
        if (deptFilter) {
            const deptTeachers = systemData.teachers.filter(t => t.department === deptFilter).map(t => t.id);
            assignedList = assignedList.filter(tid => deptTeachers.includes(tid));
        }
    }

    const assignedCount = assignedList.length;

    // Fetch matching submissions
    const subs = systemData.submissions.filter(s => s.assignmentId === currentAuditAssignmentId && assignedList.includes(s.teacherId));
    const submittedCount = subs.filter(s => s.status === 'ส่งแล้ว').length;
    const pendingCount = subs.filter(s => s.status === 'รอตรวจสอบ').length;
    const incompleteCount = assignedCount - submittedCount;

    // Stats Cards inside modal
    document.getElementById('modalStatAssigned').textContent = assignedCount + ' คน';
    document.getElementById('modalStatSubmitted').textContent = submittedCount + ' คน';
    document.getElementById('modalStatPending').textContent = pendingCount + ' คน';
    document.getElementById('modalStatIncomplete').textContent = incompleteCount + ' คน';

    // Render Teachers List
    const tbody = document.getElementById('modalTeachersTableBody');
    tbody.innerHTML = '';

    if (assignedCount === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-slate-500 font-medium bg-slate-50/20">
                    <i class="fas fa-users-slash text-4xl text-slate-300 mb-3 block"></i>
                    ไม่มีรายชื่อครูที่ได้รับมอบหมายในหัวข้อนี้
                </td>
            </tr>
        `;
        return;
    }

    assignedList.forEach(teacherId => {
        const teacher = systemData.teachers.find(t => t.id === teacherId);
        if (!teacher) return;

        const sub = systemData.submissions.find(s => s.assignmentId === currentAuditAssignmentId && s.teacherId === teacherId);
        
        let subStatus = 'ยังไม่ส่ง';
        let subDate = '-';
        let feedbackText = '';
        let files = [];
        let submissionId = '';

        if (sub) {
            subStatus = getDetailedStatus(sub, assignment);
            subDate = sub.submissionDate ? formatThaiDate(sub.submissionDate) : '-';
            feedbackText = sub.feedback || '';
            files = sub.files || [];
            submissionId = sub.id;
        }

        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-slate-50/40 transition duration-150';

        // Attached files HTML
        let filesHtml = '-';
        if (files.length > 0) {
            filesHtml = files.map(file => {
                if (file.url && file.url !== '#') {
                    return `
                        <a href="${file.url}" target="_blank" class="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-2 py-0.5 rounded font-semibold shadow-sm transition max-w-[10rem] truncate" title="${file.name}">
                            <i class="fas fa-external-link-alt text-[9px]"></i> ${file.name}
                        </a>
                    `;
                } else {
                    return `
                        <span class="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded" title="ออฟไลน์: ไม่มีลิงก์ไดรฟ์">
                            <i class="fas fa-file"></i> ${file.name}
                        </span>
                    `;
                }
            }).join('<br>');
        }

        let textHtml = '';
        if (sub && sub.submissionText) {
            textHtml = `<div class="mt-2 text-left p-2 bg-blue-50 border border-blue-100 rounded-md text-[11px] text-blue-800"><p class="font-semibold mb-0.5"><i class="fas fa-align-left mr-1"></i>รายละเอียด:</p><p class="whitespace-pre-wrap leading-tight text-blue-700">${sub.submissionText}</p></div>`;
        }

        // Action controls
        let actionControls = `<div class="text-center mb-1 flex flex-col gap-1">${filesHtml}${textHtml}</div>`;
        if (sub && sub.status === 'รอตรวจสอบ') {
            actionControls += `
                <div class="flex items-center justify-center gap-1.5 mt-1">
                    <button onclick="approveSubmissionFromModal('${sub.id}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg text-[11px] font-bold transition border border-emerald-100 hover:border-emerald-600 shadow-sm" title="อนุมัติงานเข้าสู่ระบบ">
                        <i class="fas fa-check text-[9px]"></i> อนุมัติ
                    </button>
                    <button onclick="rejectSubmissionFromModal('${sub.id}')" class="px-2 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg text-[11px] font-bold transition border border-rose-100 hover:border-rose-600 shadow-sm" title="ส่งกลับให้คุณครูแก้ไข">
                        <i class="fas fa-undo text-[9px]"></i> ตีกลับ
                    </button>
                </div>
            `;
        }

        // Feedback Text Block
        const feedbackBlock = feedbackText
            ? `<div class="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-100/50 p-1.5 rounded-lg max-w-[12rem] break-words"><i class="fas fa-comment mr-1"></i>ส่งแก้: ${feedbackText}</div>`
            : '<span class="text-xs text-slate-400 font-normal">-</span>';

        row.innerHTML = `
            <td class="px-5 py-4">
                <p class="font-bold text-slate-800 leading-snug">${teacher.name}</p>
                <span class="inline-block mt-0.5 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-semibold">${teacher.department}</span>
            </td>
            <td class="px-5 py-4 text-center shrink-0">
                ${getStatusBadge(subStatus)}
            </td>
            <td class="px-5 py-4 text-xs font-semibold text-slate-600">
                <i class="far fa-clock text-slate-400 mr-1"></i>${subDate}
            </td>
            <td class="px-5 py-4">
                ${feedbackBlock}
            </td>
            <td class="px-5 py-4">
                ${actionControls}
            </td>
        `;

        tbody.appendChild(row);
    });
}

// Audit Action: Approve Submission
function approveSubmissionFromModal(submissionId) {
    Swal.fire({
        title: 'อนุมัติการรับงาน?',
        text: 'ต้องการตรวจสอบและอนุมัติหลักฐานงานชิ้นนี้ของครูหรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันอนุมัติ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#10b981'
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading();
            setTimeout(() => {
                const submission = systemData.submissions.find(s => s.id === submissionId);
                if (submission) {
                    submission.status = 'ส่งแล้ว';
                    saveSystemData(systemData);

                    // Send notification to teacher
                    const assignment = systemData.assignments.find(a => a.id === submission.assignmentId);
                    const teacherUser = systemData.users.find(u => u.teacherId === submission.teacherId);
                    if (teacherUser && assignment) {
                        createNotification(
                            teacherUser.id,
                            `งาน "${assignment.name}" ของคุณได้รับการตรวจรับเรียบร้อยแล้ว`,
                            'approval',
                            'my-tasks.html'
                        );
                    }

                    // Refresh UIs
                    initPage();
                    refreshAuditModal();

                    Swal.fire({
                        icon: 'success',
                        title: 'สำเร็จ',
                        text: 'อนุมัติและรับเข้าระบบเรียบร้อยแล้ว',
                        confirmButtonColor: '#10b981'
                    });
                }
                hideLoading();
            }, 500);
        }
    });
}

// Audit Action: Reject/Request correction
function rejectSubmissionFromModal(submissionId) {
    Swal.fire({
        title: 'ส่งกลับให้ครูแก้ไข',
        input: 'textarea',
        inputLabel: 'สาเหตุและข้อเสนอแนะในการแก้ไข',
        inputPlaceholder: 'ระบุคำอธิบายเพื่อให้คุณครูปรับปรุงงานและส่งใหม่ เช่น อัปโหลดเอกสารไม่สมบูรณ์...',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันตีกลับ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f43f5e',
        preConfirm: (value) => {
            if (!value || value.trim() === '') {
                Swal.showValidationMessage('กรุณาระบุข้อคิดเห็น/สาเหตุสำหรับการแก้ไข');
                return false;
            }
            return value;
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            showLoading();
            setTimeout(() => {
                const submission = systemData.submissions.find(s => s.id === submissionId);
                if (submission) {
                    submission.status = 'ส่งแก้ไข';
                    submission.feedback = result.value;
                    saveSystemData(systemData);

                    // Send notification to teacher
                    const assignment = systemData.assignments.find(a => a.id === submission.assignmentId);
                    const teacherUser = systemData.users.find(u => u.teacherId === submission.teacherId);
                    if (teacherUser && assignment) {
                        createNotification(
                            teacherUser.id,
                            `งาน "${assignment.name}" ถูกตีกลับแก้ไข: ${submission.feedback}`,
                            'rejection',
                            'my-tasks.html'
                        );
                    }

                    // Refresh UIs
                    initPage();
                    refreshAuditModal();

                    Swal.fire({
                        icon: 'success',
                        title: 'สำเร็จ',
                        text: 'ตีกลับการรับงานและแจ้งเตือนคุณครูเรียบร้อยแล้ว',
                        confirmButtonColor: '#f43f5e'
                    });
                }
                hideLoading();
            }, 500);
        }
    });
}

// CSS Style Badge Helper
function getStatusBadge(status) {
    const badges = {
        'ส่งแล้ว': 'badge-green',
        'ยังไม่ส่ง': 'badge-red',
        'รอตรวจสอบ': 'badge-yellow',
        'เกินกำหนด': 'badge-orange',
        'ส่งแก้ไข': 'badge-blue'
    };
    return `<span class="badge ${badges[status] || 'badge-gray'}">${status}</span>`;
}

// Export All Assignment Summary report as CSV
function exportAllAssignmentsToCSV() {
    let assignments = systemData.assignments || [];
    const targetTeachers = getTargetTeachers();
    const targetTeacherIds = targetTeachers.map(t => t.id);

    // Filter assignments that are relevant to target teachers
    assignments = assignments.filter(a => 
        (a.assignedTeachers || []).some(tid => targetTeacherIds.includes(tid))
    );

    if (assignments.length === 0) {
        Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลภาระงานที่จะส่งออก', 'info');
        return;
    }

    const header = ['รหัสงาน', 'ชื่องานภาระงาน', 'กลุ่มงาน', 'กำหนดส่ง', 'ครูที่รับมอบหมาย', 'ส่งแล้ว (อนุมัติ)', 'รอตรวจสอบ', 'ค้างส่ง/แก้', 'อัตราความสำเร็จ'];
    const csvRows = [header.join(',')];

    assignments.forEach(a => {
        const workGroup = systemData.workGroups.find(wg => wg.id === a.workGroupId);
        const workGroupName = workGroup ? workGroup.name : 'ไม่ระบุ';

        // Filter assigned teachers
        let assignedList = a.assignedTeachers || [];
        if (currentUser.role === 'head') {
            assignedList = assignedList.filter(tid => targetTeacherIds.includes(tid));
        }

        const total = assignedList.length;
        if (total === 0) return;

        const subs = systemData.submissions.filter(s => s.assignmentId === a.id && assignedList.includes(s.teacherId));
        const submitted = subs.filter(s => s.status === 'ส่งแล้ว').length;
        const pending = subs.filter(s => s.status === 'รอตรวจสอบ').length;
        const incomplete = total - submitted;
        const percent = total > 0 ? Math.round((submitted / total) * 100) : 0;

        const row = [
            a.id,
            `"${a.name}"`,
            `"${workGroupName}"`,
            `"${a.dueDate}"`,
            total,
            submitted,
            pending,
            incomplete,
            `${percent}%`
        ];
        csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `assignments_summary_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export teacher submission list for a specific assignment as CSV
function exportAssignmentCSV() {
    if (!currentAuditAssignmentId) return;

    const assignment = systemData.assignments.find(a => a.id === currentAuditAssignmentId);
    if (!assignment) return;

    const targetTeachers = getTargetTeachers();
    const targetTeacherIds = targetTeachers.map(t => t.id);

    let assignedList = assignment.assignedTeachers || [];
    if (currentUser.role === 'head') {
        assignedList = assignedList.filter(tid => targetTeacherIds.includes(tid));
    } else {
        const deptFilter = document.getElementById('filterDept').value;
        if (deptFilter) {
            const deptTeachers = systemData.teachers.filter(t => t.department === deptFilter).map(t => t.id);
            assignedList = assignedList.filter(tid => deptTeachers.includes(tid));
        }
    }

    if (assignedList.length === 0) {
        Swal.fire('ไม่มีข้อมูล', 'ไม่มีรายชื่อครูในหัวข้อนี้ให้ส่งออก', 'info');
        return;
    }

    const header = ['รหัสครู', 'ชื่อครูผู้ส่งงาน', 'กลุ่มสาระฯ', 'สถานะการส่ง', 'วันที่ส่งงาน', 'คำติชม/ข้อคิดเห็น'];
    const csvRows = [header.join(',')];

    assignedList.forEach(tid => {
        const teacher = systemData.teachers.find(t => t.id === tid);
        if (!teacher) return;

        const sub = systemData.submissions.find(s => s.assignmentId === currentAuditAssignmentId && s.teacherId === tid);
        let status = 'ยังไม่ส่ง';
        let date = '-';
        let feedback = '';

        if (sub) {
            status = getDetailedStatus(sub, assignment);
            date = sub.submissionDate || '-';
            feedback = sub.feedback || '';
        }

        const row = [
            teacher.id,
            `"${teacher.name}"`,
            `"${teacher.department}"`,
            `"${status}"`,
            `"${date}"`,
            `"${feedback.replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `assignment_${assignment.id}_report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Generate print page and trigger system print dialog for a specific assignment
function printAssignmentReport() {
    if (!currentAuditAssignmentId) return;

    const assignment = systemData.assignments.find(a => a.id === currentAuditAssignmentId);
    if (!assignment) return;

    const workGroup = systemData.workGroups.find(wg => wg.id === assignment.workGroupId);
    const workGroupName = workGroup ? workGroup.name : 'ไม่ระบุ';

    const targetTeachers = getTargetTeachers();
    const targetTeacherIds = targetTeachers.map(t => t.id);

    let assignedList = assignment.assignedTeachers || [];
    if (currentUser.role === 'head') {
        assignedList = assignedList.filter(tid => targetTeacherIds.includes(tid));
    } else {
        const deptFilter = document.getElementById('filterDept').value;
        if (deptFilter) {
            const deptTeachers = systemData.teachers.filter(t => t.department === deptFilter).map(t => t.id);
            assignedList = assignedList.filter(tid => deptTeachers.includes(tid));
        }
    }

    const total = assignedList.length;
    const subs = systemData.submissions.filter(s => s.assignmentId === currentAuditAssignmentId && assignedList.includes(s.teacherId));
    const submittedCount = subs.filter(s => s.status === 'ส่งแล้ว').length;
    const pendingCount = subs.filter(s => s.status === 'รอตรวจสอบ').length;
    const incompleteCount = total - submittedCount;
    const percent = total > 0 ? Math.round((submittedCount / total) * 100) : 0;

    let tasksTableRowsHtml = '';
    if (total === 0) {
        tasksTableRowsHtml = '<tr><td colspan="6" style="text-align: center;">ไม่มีรายชื่อครูได้รับมอบหมาย</td></tr>';
    } else {
        assignedList.forEach((tid, idx) => {
            const teacher = systemData.teachers.find(t => t.id === tid);
            const sub = systemData.submissions.find(s => s.assignmentId === currentAuditAssignmentId && s.teacherId === tid);
            
            let status = 'ยังไม่ส่ง';
            let date = '-';
            let feedback = '-';

            if (sub) {
                status = getDetailedStatus(sub, assignment);
                date = sub.submissionDate ? formatThaiDate(sub.submissionDate) : '-';
                feedback = sub.feedback || '-';
            }

            tasksTableRowsHtml += `
                <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="text-align: center;">${teacher ? teacher.id : tid}</td>
                    <td>
                        <strong>${teacher ? teacher.name : 'ไม่ระบุ'}</strong>
                    </td>
                    <td style="text-align: center;">${teacher ? teacher.department : '-'}</td>
                    <td style="text-align: center;">${status}</td>
                    <td style="text-align: center;">${date}</td>
                </tr>
            `;
        });
    }

    const printContainer = document.getElementById('printReportContainer');
    printContainer.innerHTML = `
        <div style="font-family: 'Sarabun', sans-serif; padding: 20px;">
            <div style="text-align: center; margin-bottom: 25px;">
                <h2 style="margin: 0 0 5px 0;">รายงานความก้าวหน้าการตรวจสอบการส่งงานรายภาระงาน</h2>
                <h3 style="margin: 0; color: #4b5563;">โรงเรียนบ้านสร้างสื่อ</h3>
                <p style="margin: 5px 0; font-size: 13px; color: #6b7280;">รายงาน ณ วันที่: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.</p>
            </div>
            
            <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #fcfcfc;">
                <table style="width: 100%; border: none;">
                    <tr style="border: none;">
                        <td style="border: none; padding: 4px 0; width: 60%;"><strong>หัวข้อภาระงาน:</strong> ${assignment.name}</td>
                        <td style="border: none; padding: 4px 0;"><strong>รหัสภาระงาน:</strong> ${assignment.id}</td>
                    </tr>
                    <tr style="border: none;">
                        <td style="border: none; padding: 4px 0;"><strong>กลุ่มภาระงานหลัก:</strong> ${workGroupName}</td>
                        <td style="border: none; padding: 4px 0;"><strong>กำหนดส่งผลงาน:</strong> ${formatThaiDate(assignment.dueDate)}</td>
                    </tr>
                </table>
            </div>

            <div style="margin-bottom: 25px;">
                <h4 style="margin: 0 0 10px 0;">สรุปสถิติความพร้อมเพรียง</h4>
                <table style="width: 100%; text-align: center;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th>ครูที่รับมอบหมาย</th>
                            <th>ส่งงานสำเร็จ</th>
                            <th>รอตรวจเข้าระบบ</th>
                            <th>ค้างส่ง / ให้แก้ไข</th>
                            <th>อัตราความพร้อมเพรียง</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${total} คน</td>
                            <td style="color: #10b981; font-weight: bold;">${submittedCount} คน</td>
                            <td style="color: #d97706; font-weight: bold;">${pendingCount} คน</td>
                            <td style="color: #ef4444; font-weight: bold;">${incompleteCount} คน</td>
                            <td style="background-color: #f0fdf4; font-weight: bold; font-size: 16px; color: #16a34a;">${percent}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="margin-bottom: 40px;">
                <h4 style="margin: 0 0 10px 0;">รายละเอียดการส่งงานของบุคลากรรายบุคคล</h4>
                <table style="width: 100%;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="width: 8%; text-align: center;">ลำดับ</th>
                            <th style="width: 15%; text-align: center;">รหัสบุคลากร</th>
                            <th style="width: 32%;">ชื่อ-นามสกุลครูผู้ส่ง</th>
                            <th style="width: 17%; text-align: center;">กลุ่มสาระฯ</th>
                            <th style="width: 14%; text-align: center;">สถานะล่าสุด</th>
                            <th style="width: 14%; text-align: center;">วันที่ส่งหลักฐาน</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tasksTableRowsHtml}
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 60px; width: 100%; display: flex; justify-content: space-between;">
                <div style="text-align: center; width: 45%;">
                    <p style="margin-bottom: 45px;">&nbsp;</p>
                </div>
                <div style="text-align: center; width: 45%;">
                    <p style="margin-bottom: 45px;">ลงชื่อ.............................................................. ผู้รายงานสรุป<br>
                    ( ${currentUser.name} )</p>
                    <p>ตำแหน่ง: ${getRoleText(currentUser.role)}</p>
                </div>
            </div>
        </div>
    `;

    // Trigger printing dialog
    setTimeout(() => {
        window.print();
    }, 150);
}
