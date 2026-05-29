// Individual Submissions Javascript Module
let currentAuditTeacherId = null;

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
    if (currentAuditTeacherId) {
        refreshAuditModal();
    }
};

function initPage() {
    loadDepartmentOptions();
    calculateOverallStats();
    renderTeachersTable();
}

// Calculate top stats cards
function calculateOverallStats() {
    let teachers = systemData.teachers || [];
    
    // Filter by department if the user is a Department Head
    if (currentUser.role === 'head') {
        const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
        if (headTeacher) {
            teachers = teachers.filter(t => t.department === headTeacher.department);
        }
    }

    let total = teachers.length;
    let completed100 = 0;
    let pendingReview = 0;
    let incomplete = 0;

    teachers.forEach(teacher => {
        const teacherSubmissions = systemData.submissions.filter(s => s.teacherId === teacher.id);
        const totalTasks = teacherSubmissions.length;
        
        if (totalTasks > 0) {
            const submitted = teacherSubmissions.filter(s => s.status === 'ส่งแล้ว').length;
            const pending = teacherSubmissions.filter(s => s.status === 'รอตรวจสอบ').length;
            const remaining = totalTasks - submitted;

            if (submitted === totalTasks) {
                completed100++;
            }
            if (pending > 0) {
                pendingReview++;
            }
            if (remaining > 0) {
                incomplete++;
            }
        }
    });

    document.getElementById('statTotalTeachers').textContent = total;
    document.getElementById('statCompleted100').textContent = completed100;
    document.getElementById('statPendingReview').textContent = pendingReview;
    document.getElementById('statIncomplete').textContent = incomplete;
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

// Render main table listing teachers
function renderTeachersTable() {
    const tbody = document.getElementById('teachersSubmissionsTableBody');
    const noDataView = document.getElementById('noDataView');
    if (!tbody) return;

    tbody.innerHTML = '';

    let teachers = systemData.teachers || [];

    // 1. Role-based department filtering
    if (currentUser.role === 'head') {
        const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
        if (headTeacher) {
            teachers = teachers.filter(t => t.department === headTeacher.department);
        }
    }

    // 2. Fetch filters
    const searchQuery = document.getElementById('searchTeacherInput').value.toLowerCase().trim();
    const progressFilter = document.getElementById('filterProgress').value;
    const deptFilter = document.getElementById('filterDept').value;
    const sortVal = document.getElementById('sortTeachers').value;

    // Apply Search filter
    if (searchQuery) {
        teachers = teachers.filter(t => 
            t.name.toLowerCase().includes(searchQuery) || 
            t.id.toLowerCase().includes(searchQuery)
        );
    }

    // Apply Department filter (Admin only, Head is pre-filtered)
    if (currentUser.role === 'admin' && deptFilter) {
        teachers = teachers.filter(t => t.department === deptFilter);
    }

    // Calculate details and map to a helper list for filtering and sorting
    let mappedTeachers = teachers.map(teacher => {
        const subs = systemData.submissions.filter(s => s.teacherId === teacher.id);
        const total = subs.length;
        const submitted = subs.filter(s => s.status === 'ส่งแล้ว').length;
        const pending = subs.filter(s => s.status === 'รอตรวจสอบ').length;
        const rejected = subs.filter(s => s.status === 'ส่งแก้ไข').length;
        
        const overdue = subs.filter(s => {
            const assignment = systemData.assignments.find(a => a.id === s.assignmentId);
            return s.status === 'ยังไม่ส่ง' && assignment && new Date(assignment.dueDate) < new Date();
        }).length;
        
        const notSubmitted = subs.filter(s => {
            const assignment = systemData.assignments.find(a => a.id === s.assignmentId);
            return s.status === 'ยังไม่ส่ง' && (!assignment || new Date(assignment.dueDate) >= new Date());
        }).length;

        const progressPercent = total > 0 ? Math.round((submitted / total) * 100) : 0;

        return {
            teacher,
            total,
            submitted,
            pending,
            rejected,
            overdue,
            notSubmitted,
            progressPercent
        };
    });

    // Apply Progress level filter
    if (progressFilter === 'completed') {
        mappedTeachers = mappedTeachers.filter(item => item.total > 0 && item.progressPercent === 100);
    } else if (progressFilter === 'incomplete') {
        mappedTeachers = mappedTeachers.filter(item => item.total > 0 && item.progressPercent < 100);
    } else if (progressFilter === 'no-tasks') {
        mappedTeachers = mappedTeachers.filter(item => item.total === 0);
    }

    // Apply Sorting
    if (sortVal === 'name-asc') {
        mappedTeachers.sort((a, b) => a.teacher.name.localeCompare(b.teacher.name, 'th'));
    } else if (sortVal === 'progress-desc') {
        mappedTeachers.sort((a, b) => b.progressPercent - a.progressPercent);
    } else if (sortVal === 'progress-asc') {
        mappedTeachers.sort((a, b) => a.progressPercent - b.progressPercent);
    } else if (sortVal === 'pending-desc') {
        mappedTeachers.sort((a, b) => b.pending - a.pending);
    }

    // Hide or show noData view
    if (mappedTeachers.length === 0) {
        noDataView.classList.remove('hidden');
        return;
    } else {
        noDataView.classList.add('hidden');
    }

    mappedTeachers.forEach(item => {
        const t = item.teacher;
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-slate-50/50 transition duration-150 group';

        // Determine Progress Bar Color
        let barColor = 'bg-slate-300';
        if (item.total > 0) {
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
            <td class="px-6 py-4 text-sm font-semibold text-slate-500 group-hover:text-slate-800 transition">${t.id}</td>
            <td class="px-6 py-4">
                <p class="font-bold text-slate-800">${t.name}</p>
                <p class="text-xs text-slate-400 font-medium">${t.position}</p>
            </td>
            <td class="px-6 py-4 text-sm text-slate-600 font-semibold">${t.department}</td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="progress-bar-container shadow-inner">
                        <div class="progress-bar-fill ${barColor}" style="width: ${item.total > 0 ? item.progressPercent : 0}%"></div>
                    </div>
                    <span class="text-sm font-bold text-slate-700 shrink-0 w-10 text-right">
                        ${item.total > 0 ? item.progressPercent + '%' : 'N/A'}
                    </span>
                </div>
                <p class="text-xs text-slate-400 mt-1 font-medium">ส่งแล้ว ${item.submitted} / ${item.total} งาน</p>
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-wrap gap-1.5 max-w-xs">
                    ${item.submitted > 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">ส่งแล้ว ${item.submitted}</span>` : ''}
                    ${item.pending > 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-100 rounded-full animate-pulse">รอตรวจ ${item.pending}</span>` : ''}
                    ${item.overdue > 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 rounded-full">เกินกำหนด ${item.overdue}</span>` : ''}
                    ${item.rejected > 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 rounded-full">ให้แก้ไข ${item.rejected}</span>` : ''}
                    ${item.notSubmitted > 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200 rounded-full">ค้างส่ง ${item.notSubmitted}</span>` : ''}
                    ${item.total === 0 ? `<span class="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-400 rounded-full">ไม่มีงานมอบหมาย</span>` : ''}
                </div>
            </td>
            <td class="px-6 py-4 text-center">
                <button onclick="openAuditModal('${t.id}')" class="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-bold transition shadow-sm border border-indigo-100 hover:border-indigo-600 flex items-center gap-1.5 mx-auto">
                    <i class="fas fa-search-plus"></i> ตรวจสอบ
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function setupEventHandlers() {
    const searchTeacherInput = document.getElementById('searchTeacherInput');
    const filterProgress = document.getElementById('filterProgress');
    const filterDept = document.getElementById('filterDept');
    const sortTeachers = document.getElementById('sortTeachers');

    const triggerRender = () => renderTeachersTable();

    if (searchTeacherInput) searchTeacherInput.addEventListener('input', triggerRender);
    if (filterProgress) filterProgress.addEventListener('change', triggerRender);
    if (filterDept) filterDept.addEventListener('change', triggerRender);
    if (sortTeachers) sortTeachers.addEventListener('change', triggerRender);
}

// Modal handling logic
function openAuditModal(teacherId) {
    const teacher = systemData.teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    currentAuditTeacherId = teacherId;

    // Load static values
    document.getElementById('modalTeacherName').textContent = teacher.name;
    document.getElementById('modalTeacherId').textContent = teacher.id;
    document.getElementById('modalTeacherDept').textContent = teacher.department;

    refreshAuditModal();

    // Show modal smoothly
    const modal = document.getElementById('auditTeacherModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock scrolling background
}

function closeAuditModal() {
    const modal = document.getElementById('auditTeacherModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto'; // Unlock scrolling
    currentAuditTeacherId = null;
}

// Re-calculate and render all contents inside the Modal
function refreshAuditModal() {
    if (!currentAuditTeacherId) return;

    const teacherSubmissions = systemData.submissions.filter(s => s.teacherId === currentAuditTeacherId);
    const assignedCount = teacherSubmissions.length;
    const submittedCount = teacherSubmissions.filter(s => s.status === 'ส่งแล้ว').length;
    const pendingCount = teacherSubmissions.filter(s => s.status === 'รอตรวจสอบ').length;
    const incompleteCount = assignedCount - submittedCount;

    // Stats Cards
    document.getElementById('modalStatAssigned').textContent = assignedCount;
    document.getElementById('modalStatSubmitted').textContent = submittedCount;
    document.getElementById('modalStatPending').textContent = pendingCount;
    document.getElementById('modalStatIncomplete').textContent = incompleteCount;

    // Tasks list render
    const tbody = document.getElementById('modalAssignmentsTableBody');
    tbody.innerHTML = '';

    if (assignedCount === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-slate-500 font-medium bg-slate-50/20">
                    <i class="fas fa-folder-open text-4xl text-slate-300 mb-3 block"></i>
                    ยังไม่ได้รับมอบหมายงานใด ๆ ในระบบ
                </td>
            </tr>
        `;
        return;
    }

    teacherSubmissions.forEach(sub => {
        const assignment = systemData.assignments.find(a => a.id === sub.assignmentId);
        if (!assignment) return;

        const workGroup = systemData.workGroups.find(wg => wg.id === assignment.workGroupId);
        const workGroupName = workGroup ? workGroup.name : 'ไม่ระบุ';

        const detailedStatus = getDetailedStatus(sub, assignment);

        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-slate-50/40 transition duration-150';

        // Attached files markup
        let filesHtml = '-';
        if (sub.files && sub.files.length > 0) {
            filesHtml = sub.files.map(file => {
                if (file.url && file.url !== '#') {
                    return `
                        <a href="${file.url}" target="_blank" class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-semibold shadow-sm transition max-w-[12rem] truncate" title="${file.name}">
                            <i class="fas fa-external-link-alt text-[10px]"></i> ${file.name}
                        </a>
                    `;
                } else {
                    return `
                        <span class="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded" title="ออฟไลน์: ไม่มีลิงก์ไดรฟ์">
                            <i class="fas fa-file"></i> ${file.name}
                        </span>
                    `;
                }
            }).join('<br>');
        }

        let textHtml = '';
        if (sub && sub.submissionText) {
            textHtml = `<div class="mt-2 text-left p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800"><p class="font-semibold mb-1"><i class="fas fa-align-left mr-1"></i>รายละเอียด:</p><p class="whitespace-pre-wrap leading-relaxed text-blue-700">${sub.submissionText}</p></div>`;
        }

        // Action Audit Buttons
        let actionControls = `<div class="text-center mb-1 flex flex-col gap-1">${filesHtml}${textHtml}</div>`;
        if (sub.status === 'รอตรวจสอบ') {
            actionControls += `
                <div class="flex items-center justify-center gap-2 mt-1">
                    <button onclick="approveSubmissionFromModal('${sub.id}')" class="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg text-xs font-bold transition border border-emerald-100 hover:border-emerald-600 shadow-sm" title="อนุมัติงานเข้าสู่ระบบ">
                        <i class="fas fa-check"></i> อนุมัติ
                    </button>
                    <button onclick="rejectSubmissionFromModal('${sub.id}')" class="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg text-xs font-bold transition border border-rose-100 hover:border-rose-600 shadow-sm" title="ส่งกลับให้คุณครูแก้ไข">
                        <i class="fas fa-undo"></i> ตีกลับแก้
                    </button>
                </div>
            `;
        }

        // Feedback / comments section if exists
        const commentSection = sub.feedback 
            ? `<div class="mt-1 text-xs text-rose-600 bg-rose-50 border border-rose-100/50 p-1.5 rounded-lg font-semibold"><i class="fas fa-comment mr-1"></i>ส่งแก้: ${sub.feedback}</div>` 
            : '';

        row.innerHTML = `
            <td class="px-5 py-4">
                <p class="font-bold text-slate-800 leading-tight">${assignment.name}</p>
                <span class="inline-block mt-1 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-semibold"><i class="fas fa-tags mr-1"></i>${workGroupName}</span>
                ${commentSection}
            </td>
            <td class="px-5 py-4 text-center shrink-0">
                ${getStatusBadge(detailedStatus)}
            </td>
            <td class="px-5 py-4 text-xs font-semibold text-slate-600">
                <i class="far fa-calendar-times text-slate-400 mr-1"></i>${formatThaiDate(assignment.dueDate)}
            </td>
            <td class="px-5 py-4 text-xs font-semibold text-slate-600">
                <i class="far fa-calendar-check text-slate-400 mr-1"></i>${formatThaiDate(sub.submissionDate)}
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
        text: 'ต้องการตรวจสอบและอนุมัติหลักฐานงานนี้หรือไม่?',
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

// Export All Summary report as CSV
function exportAllSummaryToCSV() {
    let teachers = systemData.teachers || [];

    // Filter by department if the user is a Department Head
    if (currentUser.role === 'head') {
        const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
        if (headTeacher) {
            teachers = teachers.filter(t => t.department === headTeacher.department);
        }
    }

    if (teachers.length === 0) {
        Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลครูที่จะส่งออก', 'info');
        return;
    }

    const header = ['รหัสครู', 'ชื่อ-นามสกุล', 'กลุ่มสาระฯ', 'งานทั้งหมด', 'ส่งแล้ว', 'รอตรวจ', 'ค้างส่ง/แก้', 'เปอร์เซ็นต์ความคืบหน้า'];
    const csvRows = [header.join(',')];

    teachers.forEach(t => {
        const subs = systemData.submissions.filter(s => s.teacherId === t.id);
        const total = subs.length;
        const submitted = subs.filter(s => s.status === 'ส่งแล้ว').length;
        const pending = subs.filter(s => s.status === 'รอตรวจสอบ').length;
        const incomplete = total - submitted;
        const percent = total > 0 ? Math.round((submitted / total) * 100) : 0;

        const row = [
            t.id,
            `"${t.name}"`,
            `"${t.department}"`,
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
    link.setAttribute('download', `submission_summary_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export specific teacher's submissions as CSV
function exportIndividualCSV() {
    if (!currentAuditTeacherId) return;

    const teacher = systemData.teachers.find(t => t.id === currentAuditTeacherId);
    const submissions = systemData.submissions.filter(s => s.teacherId === currentAuditTeacherId);

    if (!teacher || submissions.length === 0) {
        Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลงานสำหรับคุณครูท่านนี้', 'info');
        return;
    }

    const header = ['ชื่องาน', 'กลุ่มงาน', 'สถานะการส่ง', 'กำหนดส่ง', 'วันที่ส่ง', 'ข้อเสนอแนะจากผู้ประเมิน'];
    const csvRows = [header.join(',')];

    submissions.forEach(s => {
        const assignment = systemData.assignments.find(a => a.id === s.assignmentId);
        if (!assignment) return;

        const workGroup = systemData.workGroups.find(wg => wg.id === assignment.workGroupId);
        const workGroupName = workGroup ? workGroup.name : 'ไม่ระบุ';
        const detailedStatus = getDetailedStatus(s, assignment);

        const row = [
            `"${assignment.name}"`,
            `"${workGroupName}"`,
            `"${detailedStatus}"`,
            `"${s.assignment ? s.assignment.dueDate : ''}"`,
            `"${s.submissionDate || ''}"`,
            `"${s.feedback || ''}"`
        ];
        csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${teacher.id}_${teacher.name}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Generate print page and trigger system print dialog
function printIndividualReport() {
    if (!currentAuditTeacherId) return;

    const teacher = systemData.teachers.find(t => t.id === currentAuditTeacherId);
    const submissions = systemData.submissions.filter(s => s.teacherId === currentAuditTeacherId);

    if (!teacher) return;

    const total = submissions.length;
    const submitted = submissions.filter(s => s.status === 'ส่งแล้ว').length;
    const pending = submissions.filter(s => s.status === 'รอตรวจสอบ').length;
    const incomplete = total - submitted;
    const percent = total > 0 ? Math.round((submitted / total) * 100) : 0;

    let tasksTableRowsHtml = '';
    if (total === 0) {
        tasksTableRowsHtml = '<tr><td colspan="5" style="text-align: center;">ไม่มีข้อมูลการมอบหมายงาน</td></tr>';
    } else {
        submissions.forEach((s, idx) => {
            const assignment = systemData.assignments.find(a => a.id === s.assignmentId);
            const workGroup = systemData.workGroups.find(wg => wg.id === assignment.workGroupId);
            const workGroupName = workGroup ? workGroup.name : 'ไม่ระบุ';
            const detailedStatus = getDetailedStatus(s, assignment);

            tasksTableRowsHtml += `
                <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td>
                        <strong>${assignment ? assignment.name : 'ไม่ระบุ'}</strong><br>
                        <small style="color: #666;">กลุ่มงาน: ${workGroupName}</small>
                    </td>
                    <td style="text-align: center;">${detailedStatus}</td>
                    <td style="text-align: center;">${formatThaiDate(assignment ? assignment.dueDate : '')}</td>
                    <td style="text-align: center;">${formatThaiDate(s.submissionDate)}</td>
                </tr>
            `;
        });
    }

    const printContainer = document.getElementById('printReportContainer');
    printContainer.innerHTML = `
        <div style="font-family: 'Sarabun', sans-serif; padding: 20px;">
            <div style="text-align: center; margin-bottom: 25px;">
                <h2 style="margin: 0 0 5px 0;">สรุปรายงานความก้าวหน้าการส่งงานครูรายบุคคล</h2>
                <h3 style="margin: 0; color: #4b5563;">โรงเรียนบ้านสร้างสื่อ</h3>
                <p style="margin: 5px 0; font-size: 13px; color: #6b7280;">รายงาน ณ วันที่: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.</p>
            </div>
            
            <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #fcfcfc;">
                <table style="width: 100%; border: none;">
                    <tr style="border: none;">
                        <td style="border: none; padding: 4px 0; width: 50%;"><strong>ชื่อ-นามสกุล:</strong> ${teacher.name}</td>
                        <td style="border: none; padding: 4px 0;"><strong>รหัสบุคลากร:</strong> ${teacher.id}</td>
                    </tr>
                    <tr style="border: none;">
                        <td style="border: none; padding: 4px 0;"><strong>กลุ่มสาระการเรียนรู้:</strong> ${teacher.department}</td>
                        <td style="border: none; padding: 4px 0;"><strong>ตำแหน่ง:</strong> ${teacher.position}</td>
                    </tr>
                </table>
            </div>

            <div style="margin-bottom: 25px;">
                <h4 style="margin: 0 0 10px 0;">สถิติการส่งงานของบุคลากร</h4>
                <table style="width: 100%; text-align: center;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th>งานที่ได้รับมอบหมาย</th>
                            <th>ส่งงานสำเร็จ</th>
                            <th>รอตรวจเข้าระบบ</th>
                            <th>ค้างส่ง / ให้แก้ไข</th>
                            <th>อัตราความสำเร็จ</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${total} งาน</td>
                            <td style="color: #10b981; font-weight: bold;">${submitted} งาน</td>
                            <td style="color: #d97706; font-weight: bold;">${pending} งาน</td>
                            <td style="color: #ef4444; font-weight: bold;">${incomplete} งาน</td>
                            <td style="background-color: #f0fdf4; font-weight: bold; font-size: 16px; color: #16a34a;">${percent}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="margin-bottom: 40px;">
                <h4 style="margin: 0 0 10px 0;">รายละเอียดผลงานแต่ละรายการ</h4>
                <table style="width: 100%;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="width: 8%; text-align: center;">ลำดับ</th>
                            <th style="width: 42%;">หัวข้องานที่ได้รับมอบหมาย</th>
                            <th style="width: 16%; text-align: center;">สถานะล่าสุด</th>
                            <th style="width: 17%; text-align: center;">กำหนดส่ง</th>
                            <th style="width: 17%; text-align: center;">วันที่ส่งหลักฐาน</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tasksTableRowsHtml}
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 60px; width: 100%; display: flex; justify-content: space-between;">
                <div style="text-align: center; width: 45%;">
                    <p style="margin-bottom: 45px;">ลงชื่อ.............................................................. ผู้รับการประเมิน<br>
                    ( ${teacher.name} )</p>
                    <p>ตำแหน่ง..............................................................</p>
                </div>
                <div style="text-align: center; width: 45%;">
                    <p style="margin-bottom: 45px;">ลงชื่อ.............................................................. ผู้ประเมิน<br>
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
