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
            
            if (currentUser.role === 'head') {
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
                row.className = 'border-b hover:bg-gray-50';
                
                // Show view files button if there are files
                let filesBtn = '';
                if (s.files && s.files.length > 0) {
                    filesBtn = `<button onclick="viewFile('${s.id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="ดูไฟล์ที่ส่ง"><i class="fas fa-eye"></i></button>`;
                }

                row.innerHTML = `
                    <td class="px-6 py-4">${s.assignment.name}</td>
                    <td class="px-6 py-4">${s.teacher.name}</td>
                    <td class="px-6 py-4">${s.teacher.department}</td>
                    <td class="px-6 py-4">${workGroupName}</td>
                    <td class="px-6 py-4">${getStatusBadge(displayStatus)}</td>
                    <td class="px-6 py-4">${formatThaiDate(s.submissionDate)}</td>
                    <td class="px-6 py-4">${formatThaiDate(s.assignment.dueDate)}</td>
                    <td class="px-6 py-4">
                        ${filesBtn}
                        ${s.status === 'รอตรวจสอบ' ? `
                            <button onclick="approveSubmission('${s.id}')" class="text-green-600 hover:text-green-800 mr-2" title="ยืนยันการรับงาน"><i class="fas fa-check"></i></button>
                            <button onclick="rejectSubmission('${s.id}')" class="text-red-600 hover:text-red-800" title="ส่งกลับแก้ไข"><i class="fas fa-times"></i></button>
                        ` : ''}
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
                        '#10b981', // badge-green
                        '#f59e0b', // badge-yellow
                        '#ef4444', // badge-red
                        '#f97316', // badge-orange
                        '#3b82f6'  // badge-blue
                    ],
                    borderColor: '#fff',
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            };

            const options = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                family: "'Sarabun', sans-serif",
                                size: 14
                            }
                        }
                    }
                }
            };

            if (statusChart) {
                statusChart.data = data;
                statusChart.update();
            } else {
                statusChart = new Chart(ctx, {
                    type: 'pie',
                    data: data,
                    options: options
                });
            }
        }

        function renderDepartmentChart(submissionsData) {
            const ctx = document.getElementById('departmentChart').getContext('2d');
            const departments = systemData.departments.filter(d => d.status === 'ใช้งาน');
            const departmentLabels = departments.map(d => d.name);

            const submittedData = [];
            const notSubmittedData = [];

            departmentLabels.forEach(deptName => {
                const teacherIdsInDept = systemData.teachers
                    .filter(t => t.department === deptName)
                    .map(t => t.id);

                const submissionsInDept = submissionsData.filter(s => teacherIdsInDept.includes(s.teacherId));

                const submittedCount = submissionsInDept.filter(s => s.status === 'ส่งแล้ว').length;
                const notSubmittedCount = submissionsInDept.length - submittedCount;

                submittedData.push(submittedCount);
                notSubmittedData.push(notSubmittedCount);
            });

            const data = {
                labels: departmentLabels,
                datasets: [
                    {
                        label: 'ส่งแล้ว',
                        data: submittedData,
                        backgroundColor: '#10b981',
                    },
                    {
                        label: 'ยังไม่ส่ง',
                        data: notSubmittedData,
                        backgroundColor: '#ef4444',
                    }
                ]
            };

            const options = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            };

            if (departmentChart) {
                departmentChart.data = data;
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

            if (currentUser.role === 'head') {
                const headTeacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
                if (headTeacher) {
                    submissions = submissions.filter(s => s.teacher && s.teacher.department === headTeacher.department);
                }
            }

            return submissions;
        }

        function setupDashboardFilters() {
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

                if (currentUser.role === 'head') {
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
            if (submission && submission.files && submission.files.length > 0) {
                const fileListHtml = submission.files.map(file => {
                    // Check if file contains url
                    if (file.url) {
                        return `<p class="text-lg"><a href="${file.url}" target="_blank" class="text-blue-600 hover:underline"><i class="fas fa-file-alt mr-2"></i>${file.name} (คลิกเพื่อเปิดดู)</a></p>`;
                    } else {
                        return `<p class="text-lg"><i class="fas fa-file-alt text-gray-500 mr-2"></i>${file.name}</p>`;
                    }
                }).join('');
                Swal.fire({
                    title: 'ไฟล์ที่ส่ง',
                    html: `<div class="space-y-2 text-left">${fileListHtml}</div>
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
            const restrictedPages = ['dashboard.html', 'assignment-management.html'];
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