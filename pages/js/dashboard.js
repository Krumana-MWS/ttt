let statusChart = null;
        let departmentChart = null;

        // Dashboard
        function loadDashboard() {
            updateDashboardStats();
            loadDepartmentFilters();
            loadAssignmentNameFilters();
            loadWorkGroupFilters();
            const initialSubmissions = getFilteredSubmissions();
            renderSubmissionsTable(initialSubmissions);
            renderStatusChart(initialSubmissions);
            renderDepartmentChart(initialSubmissions);
            setupDashboardFilters();
        }

        function updateDashboardStats() {
            let submissions = systemData.submissions;
            
            if (currentUser.role === 'teacher') {
                submissions = submissions.filter(s => s.teacherId === currentUser.teacherId);
            } else if (currentUser.role === 'head') {
                const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
                if (headTeacher) {
                    const departmentTeachers = systemData.teachers
                        .filter(t => t.department === headTeacher.department)
                        .map(t => t.id);
                    submissions = submissions.filter(s => departmentTeachers.includes(s.teacherId));
                }
            }

            const total = submissions.length; 
            const submitted = submissions.filter(s => s.status === 'ส่งแล้ว').length; 
            const pending = submissions.filter(s => s.status === 'รอตรวจสอบ').length; 
            const rejected = submissions.filter(s => s.status === 'ส่งแก้ไข').length;

            const overdue = submissions.filter(s => { 
                if (s.status === 'ยังไม่ส่ง') {
                    const assignment = systemData.assignments.find(a => a.id === s.assignmentId);
                    if (assignment) {
                        return new Date(assignment.dueDate) < new Date();
                    }
                }
                return false;
            }).length;

            const notSubmitted = submissions.filter(s => s.status === 'ยังไม่ส่ง').length - overdue;

            document.getElementById('totalAssignments').textContent = total;
            document.getElementById('submittedCount').textContent = submitted;
            document.getElementById('notSubmittedCount').textContent = notSubmitted + overdue;
            document.getElementById('pendingCount').textContent = pending;
            document.getElementById('overdueCount').textContent = overdue;
        }

        function loadDepartmentFilters() {
            const departments = systemData.departments.filter(d => d.status === 'ใช้งาน').map(d => d.name);
            const filterDepartment = document.getElementById('filterDepartment');
            filterDepartment.innerHTML = '<option value="">ทุกกลุ่มสาระฯ</option>';
            departments.forEach(dept => {
                filterDepartment.innerHTML += `<option value="${dept}">${dept}</option>`;
            });
        }

        function loadAssignmentNameFilters() {
            const assignments = systemData.assignments;
            const filterAssignmentName = document.getElementById('filterAssignmentName');
            filterAssignmentName.innerHTML = '<option value="">ทุกงาน</option>';
            assignments.forEach(a => {
                filterAssignmentName.innerHTML += `<option value="${a.id}">${a.name}</option>`;
            });
        }

        // Setup drop-down for workgroup options
        function loadWorkGroupFilters() {
            const workGroups = systemData.workGroups.filter(wg => wg.status === 'ใช้งาน');
            const filterWorkGroup = document.getElementById('filterWorkGroup');
            filterWorkGroup.innerHTML = '<option value="">ทุกกลุ่มงาน</option>';
            workGroups.forEach(wg => {
                filterWorkGroup.innerHTML += `<option value="${wg.id}">${wg.name}</option>`;
            });
        }

        function renderSubmissionsTable(submissionsToRender) {
            const tbody = document.getElementById('submissionsTableBody');
            tbody.innerHTML = '';
            submissionsToRender.forEach(s => {
                if (!s.assignment || !s.teacher) return;

                const isOverdue = s.status === 'ยังไม่ส่ง' && new Date(s.assignment.dueDate) < new Date();
                const displayStatus = isOverdue ? 'เกินกำหนด' : s.status;
                const workGroup = systemData.workGroups.find(wg => wg.id === s.assignment.workGroupId);
                const workGroupName = workGroup ? workGroup.name : 'ไม่ระบุ';

                const row = document.createElement('tr');
                row.className = 'table-row-animate border-b border-gray-50 text-sm';
                
                // Show view files button if there are files
                let filesBtn = '';
                if ((s.files && s.files.length > 0) || s.submissionText) {
                    filesBtn = `<button onclick="viewFile('${s.id}')" class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors mr-2" title="ดูรายละเอียด"><i class="fas fa-eye"></i></button>`;
                }

                let actionBtns = '';
                if (s.status === 'รอตรวจสอบ' && currentUser.role !== 'teacher') {
                    actionBtns = `
                        <button onclick="approveSubmission('${s.id}')" class="text-emerald-600 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 p-2 rounded-lg transition-colors mr-2" title="ยืนยันการรับงาน"><i class="fas fa-check"></i></button>
                        <button onclick="rejectSubmission('${s.id}')" class="text-rose-600 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition-colors" title="ส่งกลับแก้ไข"><i class="fas fa-times"></i></button>
                    `;
                }

                row.innerHTML = `
                    <td class="px-4 py-4">
                        <div class="font-semibold text-gray-800">${s.assignment.name}</div>
                        <div class="text-xs text-gray-500 mt-1"><i class="far fa-calendar-alt mr-1"></i>ครบกำหนด: ${formatThaiDate(s.assignment.dueDate)}</div>
                    </td>
                    <td class="px-4 py-4">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                ${s.teacher.name.charAt(0)}
                            </div>
                            <span class="text-gray-700 font-medium">${s.teacher.name}</span>
                        </div>
                    </td>
                    <td class="px-4 py-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            ${s.teacher.department}
                        </span>
                    </td>
                    <td class="px-4 py-4">${getStatusBadge(displayStatus)}</td>
                    <td class="px-4 py-4 text-center whitespace-nowrap">
                        ${filesBtn}
                        ${actionBtns}
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

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

        function renderStatusChart(submissionsData) {
            const ctx = document.getElementById('statusChart').getContext('2d');

            const submitted = submissionsData.filter(s => s.status === 'ส่งแล้ว').length;
            const pending = submissionsData.filter(s => s.status === 'รอตรวจสอบ').length;
            const rejected = submissionsData.filter(s => s.status === 'ส่งแก้ไข').length;
            const overdue = submissionsData.filter(s => s.status === 'ยังไม่ส่ง' && new Date(s.assignment.dueDate) < new Date()).length;
            const notSubmitted = submissionsData.filter(s => s.status === 'ยังไม่ส่ง').length - overdue;

            const data = {
                labels: ['ส่งแล้ว', 'รอตรวจสอบ', 'ยังไม่ส่ง', 'เกินกำหนด', 'ส่งแก้ไข'],
                datasets: [{
                    label: 'สถานะงาน',
                    data: [submitted, pending, notSubmitted, overdue, rejected],
                    backgroundColor: [
                        '#10b981', // emerald-500
                        '#fbbf24', // amber-400
                        '#f43f5e', // rose-500
                        '#c026d3', // fuchsia-600
                        '#6366f1'  // indigo-500
                    ],
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            };

            const options = {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', // Make it a sleek doughnut chart
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                family: "'Sarabun', sans-serif",
                                size: 13
                            },
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                }
            };

            if (statusChart) {
                statusChart.data = data;
                statusChart.options = options;
                statusChart.update();
            } else {
                statusChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: data,
                    options: options
                });
            }
        }

        function renderDepartmentChart(submissionsData) {
            if (currentUser.role === 'teacher') {
                const col = document.getElementById('departmentChartCol');
                if(col) col.style.display = 'none';
                return;
            }

            const ctx = document.getElementById('departmentChart').getContext('2d');
            
            let labels = [];
            let submittedData = [];
            let notSubmittedData = [];

            if (currentUser.role === 'head') {
                // For Heads, show stats of individual teachers in their department
                const titleEl = document.getElementById('departmentChartTitle');
                if (titleEl) {
                    titleEl.innerHTML = '<div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><i class="fas fa-users"></i></div>สถิติการส่งงานรายบุคคล (ในกลุ่มสาระฯ)';
                }

                const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
                if (headTeacher) {
                    const deptTeachers = systemData.teachers.filter(t => t.department === headTeacher.department && t.status === 'ใช้งาน');
                    labels = deptTeachers.map(t => t.name);
                    
                    deptTeachers.forEach(teacher => {
                        const teacherSubmissions = submissionsData.filter(s => s.teacherId === teacher.id);
                        const submittedCount = teacherSubmissions.filter(s => s.status === 'ส่งแล้ว').length;
                        const notSubmittedCount = teacherSubmissions.length - submittedCount;
                        
                        submittedData.push(submittedCount);
                        notSubmittedData.push(notSubmittedCount);
                    });
                }
            } else {
                // For Admin, show stats of departments
                const departments = systemData.departments.filter(d => d.status === 'ใช้งาน');
                labels = departments.map(d => d.name);

                labels.forEach(deptName => {
                    const teacherIdsInDept = systemData.teachers
                        .filter(t => t.department === deptName)
                        .map(t => t.id);

                    const submissionsInDept = submissionsData.filter(s => teacherIdsInDept.includes(s.teacherId));

                    const submittedCount = submissionsInDept.filter(s => s.status === 'ส่งแล้ว').length;
                    const notSubmittedCount = submissionsInDept.length - submittedCount;

                    submittedData.push(submittedCount);
                    notSubmittedData.push(notSubmittedCount);
                });
            }

            const data = {
                labels: labels,
                datasets: [
                    {
                        label: 'ส่งแล้ว',
                        data: submittedData,
                        backgroundColor: '#10b981',
                        borderRadius: 4,
                    },
                    {
                        label: 'ยังไม่ส่ง (รวมถึงรอดำเนินการ)',
                        data: notSubmittedData,
                        backgroundColor: '#f43f5e',
                        borderRadius: 4,
                    }
                ]
            };

            const options = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { borderDash: [4, 4] }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: "'Sarabun', sans-serif" },
                            usePointStyle: true
                        }
                    }
                }
            };

            if (departmentChart) {
                departmentChart.data = data;
                departmentChart.options = options;
                departmentChart.update();
            } else {
                departmentChart = new Chart(ctx, { type: 'bar', data, options });
            }
        }

        function getFilteredSubmissions(filters = {}) {
            let submissions = systemData.submissions.map(s => {
                const assignment = systemData.assignments.find(a => a.id === s.assignmentId);
                const teacher = systemData.teachers.find(t => t.id === s.teacherId);
                return { ...s, assignment, teacher };
            });

            if (currentUser.role === 'teacher') {
                submissions = submissions.filter(s => s.teacherId === currentUser.teacherId);
            } else if (currentUser.role === 'head') {
                const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
                if (headTeacher) {
                    submissions = submissions.filter(s => s.teacher && s.teacher.department === headTeacher.department);
                }
            }

            return submissions;
        }

        function setupDashboardFilters() {
            // Hide filters based on role
            if (currentUser.role === 'teacher') {
                const searchArea = document.getElementById('filterSearchArea');
                const deptArea = document.getElementById('filterDepartmentArea');
                if (searchArea) searchArea.style.display = 'none';
                if (deptArea) deptArea.style.display = 'none';
            } else if (currentUser.role === 'head') {
                const deptArea = document.getElementById('filterDepartmentArea');
                if (deptArea) deptArea.style.display = 'none';
            }

            const searchInput = document.getElementById('searchInput');
            const filterAssignmentName = document.getElementById('filterAssignmentName');
            const filterDepartment = document.getElementById('filterDepartment');
            const filterStatus = document.getElementById('filterStatus');
            const filterWorkGroup = document.getElementById('filterWorkGroup');
            const filterDueDate = document.getElementById('filterDueDate');

            const applyFilters = () => {
                let submissions = systemData.submissions.map(s => {
                    const assignment = systemData.assignments.find(a => a.id === s.assignmentId);
                    const teacher = systemData.teachers.find(t => t.id === s.teacherId);
                    return { ...s, assignment, teacher };
                });

                if (currentUser.role === 'teacher') {
                    submissions = submissions.filter(s => s.teacherId === currentUser.teacherId);
                } else if (currentUser.role === 'head') {
                    const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
                    if (headTeacher) {
                        submissions = submissions.filter(s => s.teacher && s.teacher.department === headTeacher.department);
                    }
                }

                const filters = {
                    search: searchInput.value.toLowerCase(),
                    assignmentName: filterAssignmentName.value,
                    department: filterDepartment.value,
                    status: filterStatus.value,
                    workGroup: filterWorkGroup.value,
                    dueDate: filterDueDate.value
                };

                if (filters.search) {
                    submissions = submissions.filter(s => s.teacher && s.teacher.name.toLowerCase().includes(filters.search));
                }
                if (filters.assignmentName) {
                    submissions = submissions.filter(s => s.assignment && s.assignment.id === filters.assignmentName);
                }
                if (filters.department) {
                    submissions = submissions.filter(s => s.teacher && s.teacher.department === filters.department);
                }
                if (filters.status) {
                     const isOverdueFilter = filters.status === 'เกินกำหนด';
                     submissions = submissions.filter(s => (isOverdueFilter ? (s.status === 'ยังไม่ส่ง' && new Date(s.assignment.dueDate) < new Date()) : s.status === filters.status));
                }
                if (filters.workGroup) {
                    submissions = submissions.filter(s => s.assignment && s.assignment.workGroupId === filters.workGroup);
                }
                if (filters.dueDate) {
                    submissions = submissions.filter(s => s.assignment && s.assignment.dueDate === filters.dueDate);
                }
                renderSubmissionsTable(submissions);
                renderStatusChart(submissions);
                renderDepartmentChart(submissions);
            };

            searchInput.addEventListener('input', applyFilters);
            filterAssignmentName.addEventListener('change', applyFilters);
            filterDepartment.addEventListener('change', applyFilters);
            filterStatus.addEventListener('change', applyFilters);
            filterWorkGroup.addEventListener('change', applyFilters);
            filterDueDate.addEventListener('change', applyFilters);
        }

        function viewFile(submissionId) {
            const submission = systemData.submissions.find(s => s.id === submissionId);
            if (submission && ((submission.files && submission.files.length > 0) || submission.submissionText)) {
                let fileListHtml = '';
                if (submission.files && submission.files.length > 0) {
                    fileListHtml = submission.files.map(file => {
                        if (file.url) {
                            return `<p class="text-lg"><a href="${file.url}" target="_blank" class="text-indigo-600 hover:underline"><i class="fas fa-file-alt mr-2"></i>${file.name} (คลิกเพื่อเปิดดู)</a></p>`;
                        } else {
                            return `<p class="text-lg"><i class="fas fa-file-alt text-gray-500 mr-2"></i>${file.name}</p>`;
                        }
                    }).join('');
                }
                
                let textHtml = '';
                if (submission.submissionText) {
                    textHtml = `
                        <div class="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <p class="text-sm font-semibold text-blue-800 mb-1"><i class="fas fa-align-left mr-1"></i>รายละเอียดที่ส่ง:</p>
                            <p class="text-sm text-blue-700 leading-relaxed whitespace-pre-wrap">${submission.submissionText}</p>
                        </div>
                    `;
                }

                Swal.fire({
                    title: 'รายละเอียดการส่งงาน',
                    html: `<div class="space-y-2 text-left">${fileListHtml}</div>
                           ${textHtml}
                           <p class="text-sm text-gray-600 mt-2 text-left">วันที่ส่ง: ${formatThaiDate(submission.submissionDate)}</p>`,
                    icon: 'info'
                });
            }
        }

        function approveSubmission(submissionId) {
            Swal.fire({
                title: 'ยืนยันการรับงาน',
                text: 'คุณต้องการยืนยันการรับงานนี้หรือไม่?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'ยืนยัน',
                cancelButtonText: 'ยกเลิก'
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(() => {
                        const submission = systemData.submissions.find(s => s.id === submissionId);
                        if (submission) {
                            submission.status = 'ส่งแล้ว';
                            saveSystemData(systemData);
                            loadDashboard();
                            
                            // Send notification to teacher
                            const assignment = systemData.assignments.find(a => a.id === submission.assignmentId);
                            const teacherUser = systemData.users.find(u => u.teacherId === submission.teacherId);
                            if (teacherUser && assignment) {
                                createNotification(
                                    teacherUser.id,
                                    `งาน "${assignment.name}" ได้รับการตรวจและรับเข้าระบบเรียบร้อยแล้ว`,
                                    'approval',
                                    'my-tasks.html'
                                );
                            }
                            Swal.fire('สำเร็จ', 'ยืนยันการรับงานเรียบร้อย', 'success');
                        }
                        hideLoading();
                    }, 500);
                }
            });
        }

        function rejectSubmission(submissionId) {
            Swal.fire({
                title: 'ส่งกลับแก้ไข',
                input: 'textarea',
                inputLabel: 'ข้อเสนอแนะ',
                inputPlaceholder: 'กรุณาระบุสิ่งที่ต้องแก้ไข...',
                showCancelButton: true,
                confirmButtonText: 'ส่งกลับ',
                cancelButtonText: 'ยกเลิก'
            }).then((result) => {
                if (result.isConfirmed) {
                    showLoading();
                    setTimeout(() => {
                        const submission = systemData.submissions.find(s => s.id === submissionId);
                        if (submission) {
                            submission.status = 'ส่งแก้ไข';
                            submission.feedback = result.value || 'กรุณาแก้ไขและส่งใหม่';
                            saveSystemData(systemData);
                            loadDashboard();

                            // Send notification to teacher
                            const assignment = systemData.assignments.find(a => a.id === submission.assignmentId);
                            const teacherUser = systemData.users.find(u => u.teacherId === submission.teacherId);
                            if (teacherUser && assignment) {
                                createNotification(
                                    teacherUser.id,
                                    `งาน "${assignment.name}" ถูกส่งกลับแก้ไข: ${submission.feedback}`,
                                    'rejection',
                                    'my-tasks.html'
                                );
                            }
                            Swal.fire('สำเร็จ', 'ส่งกลับให้แก้ไขเรียบร้อย', 'success');
                        }
                        hideLoading();
                    }, 500);
                }
            });
        }

        // Hook system data sync callback to automatically refresh dashboard
        window.onSystemDataSynced = function(data) {
            loadDashboard();
        };

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            currentUser = getCurrentUser();
            if (!currentUser) {
                window.location.href = 'index.html';
                return;
            }

            // Check access rights for admin/head pages
            const restrictedPages = ['assignment-management.html'];
            const pageName = window.location.pathname.split('/').pop();
            if (restrictedPages.includes(pageName) && currentUser.role === 'teacher') {
                 window.location.href = 'my-tasks.html'; // Redirect teacher away
                 return;
            }

            applySystemSettings();
            const currentUserNameEl = document.getElementById('currentUserName');
            if (currentUserNameEl) currentUserNameEl.textContent = currentUser.name;
            const currentUserRoleEl = document.getElementById('currentUserRole');
            if (currentUserRoleEl) currentUserRoleEl.textContent = getRoleText(currentUser.role);
            if(typeof initSidebar === 'function') initSidebar();
            updateNotificationUI();
            loadDashboard();
        });