// Helper to convert browser File object to Base64 string
        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = error => reject(error);
            });
        }

        // Get CSS badge class for status display
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

        // Load & Render Teacher Tasks
        function loadMyTasks() {
            if (typeof checkDueDateNotifications === 'function') checkDueDateNotifications();
            updateMyTasksSummary();
            const activeFilter = document.querySelector('#myTasksFilter button.bg-blue-600') ? document.querySelector('#myTasksFilter button.bg-blue-600').getAttribute('data-status') : 'all';
            const searchInput = document.getElementById('taskSearchInput');
            const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
            renderMyTasks(activeFilter, searchQuery);
        }

        function updateMyTasksSummary() {
            const teacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
            if (!teacher) {
                document.getElementById('myTotalTasks').textContent = 0;
                document.getElementById('mySubmittedTasks').textContent = 0;
                document.getElementById('myPendingTasks').textContent = 0;
                return;
            }

            const mySubmissions = systemData.submissions.filter(s => s.teacherId === teacher.id);
            const total = mySubmissions.length;
            const submitted = mySubmissions.filter(s => s.status === 'ส่งแล้ว').length;
            const pending = mySubmissions.filter(s => s.status === 'ยังไม่ส่ง' || s.status === 'ส่งแก้ไข').length;

            document.getElementById('myTotalTasks').textContent = total;
            document.getElementById('mySubmittedTasks').textContent = submitted;
            document.getElementById('myPendingTasks').textContent = pending;
        }

        function renderMyTasks(filterStatus = 'all', searchQuery = '') {
            const tasksList = document.getElementById('myTasksList');
            const teacher = systemData.teachers.find(t => t.id === currentUser.teacherId);

            if (!teacher) {
                tasksList.innerHTML = `
                    <div class="col-span-full text-center py-12 glass-card-sm border border-dashed border-gray-300">
                        <i class="fas fa-user-slash text-gray-300 text-5xl mb-3"></i>
                        <p class="text-gray-500">บัญชีนี้ไม่ได้เชื่อมโยงกับรหัสครูผู้สอน จึงไม่มีข้อมูลงานของฉัน</p>
                    </div>`;
                return;
            }

            let mySubmissions = systemData.submissions.filter(s => s.teacherId === teacher.id);

            // Filter logic
            if (filterStatus === 'pending') {
                mySubmissions = mySubmissions.filter(s => s.status === 'ยังไม่ส่ง' || s.status === 'ส่งแก้ไข');
            } else if (filterStatus === 'review') {
                mySubmissions = mySubmissions.filter(s => s.status === 'รอตรวจสอบ');
            } else if (filterStatus === 'submitted') {
                mySubmissions = mySubmissions.filter(s => s.status === 'ส่งแล้ว');
            }

            // Search logic
            if (searchQuery) {
                mySubmissions = mySubmissions.filter(s => {
                    const a = systemData.assignments.find(a => a.id === s.assignmentId);
                    return a && a.name.toLowerCase().includes(searchQuery);
                });
            }

            tasksList.innerHTML = '';

            if (mySubmissions.length === 0) {
                tasksList.innerHTML = `
                    <div class="col-span-full text-center py-12 glass-card-sm border border-dashed border-gray-300">
                        <i class="fas fa-clipboard-list text-gray-300 text-5xl mb-3"></i>
                        <p class="text-gray-500">ไม่พบงานตามสถานะที่เลือก</p>
                    </div>`;
                return;
            }

            mySubmissions.forEach(submission => {
                const assignment = systemData.assignments.find(a => a.id === submission.assignmentId);
                if (!assignment) return;

                const isOverdue = submission.status === 'ยังไม่ส่ง' && new Date(assignment.dueDate) < new Date();
                const displayStatus = isOverdue ? 'เกินกำหนด' : submission.status;
                const workGroup = systemData.workGroups.find(wg => wg.id === assignment.workGroupId);
                const workGroupName = workGroup ? workGroup.name : 'ไม่ระบุ';

                const allSubmissionsForAssignment = systemData.submissions.filter(s => s.assignmentId === assignment.id);
                const totalAssigned = allSubmissionsForAssignment.length;
                const totalSubmitted = allSubmissionsForAssignment.filter(s => s.status === 'ส่งแล้ว').length;
                const totalNotSubmitted = totalAssigned - totalSubmitted;

                const card = document.createElement('div');
                card.className = 'glass-card hover:shadow-md transition duration-200 p-6 flex flex-col justify-between';
                card.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h3 class="text-xl font-bold text-gray-800">${assignment.name}</h3>
                                <p class="text-sm text-blue-600 font-semibold mt-1"><i class="fas fa-tag mr-1"></i>${workGroupName}</p>
                                <div class="mt-2 flex gap-2">
                                    <span class="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-md"><i class="fas fa-check-circle mr-1"></i>ส่งแล้ว ${totalSubmitted}</span>
                                    <span class="text-xs font-medium bg-rose-100 text-rose-700 px-2 py-1 rounded-md"><i class="fas fa-times-circle mr-1"></i>ยังไม่ส่ง ${totalNotSubmitted}</span>
                                </div>
                            </div>
                            ${getStatusBadge(displayStatus)}
                        </div>
                        <p class="text-gray-600 text-sm mb-4 leading-relaxed">${assignment.description}</p>
                        <div class="grid grid-cols-2 gap-4 mb-4 border-t border-b py-3 text-sm">
                            <div>
                                <p class="text-gray-500">กำหนดส่ง</p>
                                <p class="font-semibold text-gray-800"><i class="far fa-calendar-alt text-red-500 mr-1"></i>${formatThaiDate(assignment.dueDate)}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">วันที่ส่ง</p>
                                <p class="font-semibold text-gray-800"><i class="far fa-clock text-green-500 mr-1"></i>${formatThaiDate(submission.submissionDate)}</p>
                            </div>
                        </div>

                        ${submission.files && submission.files.length > 0 ? `
                            <div class="mb-4">
                                <p class="text-xs font-semibold text-gray-500 mb-2">ไฟล์ที่แนบส่งสำเร็จ:</p>
                                <div class="space-y-1.5 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                                    ${submission.files.map(file => `
                                        <p class="text-sm text-gray-700 flex items-center justify-between">
                                            <span class="truncate pr-2">
                                                <i class="fas fa-file-alt text-blue-500 mr-2"></i>${file.name}
                                            </span>
                                            ${file.url && file.url !== '#' ? `
                                                <a href="${file.url}" target="_blank" class="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 shrink-0 bg-blue-100/50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                                                    <i class="fas fa-external-link-alt"></i> ดูไฟล์บน Drive
                                                </a>
                                            ` : `
                                                <span class="text-xs text-gray-400 font-light shrink-0">โหมดออฟไลน์</span>
                                            `}
                                        </p>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        ${submission.feedback ? `
                            <div class="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                                <p class="text-sm font-semibold text-red-800 mb-1"><i class="fas fa-comment-dots mr-1"></i>ความคิดเห็นเพื่อแก้ไข:</p>
                                <p class="text-sm text-red-700 leading-relaxed">${submission.feedback}</p>
                            </div>
                        ` : ''}

                        ${submission.submissionText ? `
                            <div class="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                <p class="text-sm font-semibold text-blue-800 mb-1"><i class="fas fa-align-left mr-1"></i>รายละเอียดที่ส่ง:</p>
                                <p class="text-sm text-blue-700 leading-relaxed whitespace-pre-wrap">${submission.submissionText}</p>
                            </div>
                        ` : ''}
                    </div>

                    <div class="mt-4">
                        ${submission.status !== 'ส่งแล้ว' && submission.status !== 'รอตรวจสอบ' ? `
                            <button onclick="submitTask('${submission.id}')" class="w-full btn-premium bg-indigo-600 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2">
                                <i class="fas fa-upload"></i> ${submission.status === 'ยังไม่ส่ง' ? 'ส่งงาน' : 'ส่งงานอีกครั้ง'}
                            </button>
                        ` : ''}
                        ${submission.status === 'รอตรวจสอบ' && !isOverdue ? `
                            <button onclick="submitTask('${submission.id}')" class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2">
                                <i class="fas fa-edit"></i> แก้ไขการส่งงาน
                            </button>
                        ` : ''}
                    </div>
                `;
                tasksList.appendChild(card);
            });
        }

        // Action: Submit Task with Google Drive upload
        function submitTask(submissionId) {
            const submission = systemData.submissions.find(s => s.id === submissionId);
            const assignment = systemData.assignments.find(a => a.id === submission.assignmentId);

            if (!submission || !assignment) return;

            let allowedTypesHtml = '';
            const allowedTypes = assignment.allowedTypes || [];
            if (allowedTypes.length > 0) {
                allowedTypesHtml = `<p class="text-sm text-gray-500 mt-2">ประเภทไฟล์ที่อนุญาต: ${allowedTypes.join(', ').toUpperCase()}</p>`;
            }

            let textSubmissionHtml = '';
            if (assignment.allowTextSubmission) {
                textSubmissionHtml = `
                    <div class="mt-4 text-left">
                        <label class="block text-gray-700 font-semibold mb-2">รายละเอียดเพิ่มเติม ${assignment.requireTextSubmission ? '<span class="text-red-500">*</span>' : '<span class="text-gray-400 font-normal">(ถ้ามี)</span>'}</label>
                        <textarea id="taskTextDetails" class="w-full px-3 py-2 border rounded-lg focus:ring focus:ring-blue-200" rows="3" placeholder="พิมพ์ข้อความ..."></textarea>
                    </div>
                `;
            }

            Swal.fire({
                title: 'ส่งงาน',
                html: `
                    <div class="text-left mb-4">
                        <p class="font-semibold text-gray-800 mb-1">${assignment.name}</p>
                        ${allowedTypesHtml}
                        <p class="text-sm text-gray-500 mt-1">แนบไฟล์ได้สูงสุด ${assignment.maxFiles || 1} ไฟล์</p>
                    </div>
                    <input type="file" id="taskFileInput" class="w-full p-2 border rounded-lg focus:ring focus:ring-blue-200" multiple>
                    ${textSubmissionHtml}
                `,
                showCancelButton: true,
                confirmButtonText: 'อัปโหลดและส่งงาน',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#2563eb',
                preConfirm: () => {
                    const fileInput = document.getElementById('taskFileInput');
                    const selectedFiles = Array.from(fileInput.files);
                    const taskTextDetails = assignment.allowTextSubmission ? document.getElementById('taskTextDetails').value.trim() : '';

                    if (assignment.requireTextSubmission && !taskTextDetails) {
                        Swal.showValidationMessage('กรุณาพิมพ์รายละเอียดเพิ่มเติม');
                        return false;
                    }

                    if (selectedFiles.length === 0) {
                        Swal.showValidationMessage('กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์');
                        return false;
                    }

                    const maxFiles = assignment.maxFiles || 1;
                    if (selectedFiles.length > maxFiles) {
                        Swal.showValidationMessage(`อนุญาตให้ส่งได้สูงสุด ${maxFiles} ไฟล์เท่านั้น`);
                        return false;
                    }

                    if (allowedTypes.length > 0) {
                        for (let file of selectedFiles) {
                            const extension = file.name.split('.').pop().toLowerCase();
                            if (!allowedTypes.includes(extension)) {
                                Swal.showValidationMessage(`ไฟล์ "${file.name}" ไม่อนุญาต! (กรุณาส่งเฉพาะไฟล์สกุล: ${allowedTypes.join(', ').toUpperCase()})`);
                                return false;
                            }
                        }
                    }
                    return { selectedFiles, taskTextDetails };
                }
            }).then(async (result) => {
                if (result.isConfirmed && result.value) {
                    const selectedFiles = result.value.selectedFiles;
                    const submissionText = result.value.taskTextDetails;
                    showLoading();

                    try {
                        const uploadedFiles = [];
                        const gasUrl = getGasUrl();

                        for (let i = 0; i < selectedFiles.length; i++) {
                            const file = selectedFiles[i];

                            if (gasUrl) {
                                // Real upload to Google Drive via GAS Web App API
                                const base64Data = await fileToBase64(file);
                                const uploadRes = await uploadFileToGAS(file.name, base64Data, file.type);
                                uploadedFiles.push({
                                    name: file.name,
                                    url: uploadRes.url // Google Drive direct share link
                                });
                            } else {
                                // Standalone Offline mode fallback mock url
                                uploadedFiles.push({
                                    name: file.name,
                                    url: '#'
                                });
                            }
                        }

                        // Update local system data submission object
                        submission.status = 'รอตรวจสอบ';
                        submission.submissionDate = new Date().toISOString();
                        submission.files = uploadedFiles;
                        submission.submissionText = submissionText;
                        submission.feedback = ''; // Clear old feedback comments

                        // Save updated local data cache and sync back to Google Sheets via GAS sync action
                        saveSystemData(systemData);

                        // Trigger notifications to task creator
                        createNotification(
                            assignment.createdBy,
                            `ครู ${currentUser.name} ส่งหลักฐานงาน "${assignment.name}" แล้ว`,
                            'new_submission',
                            'dashboard.html'
                        );

                        loadMyTasks();

                        Swal.fire({
                            icon: 'success',
                            title: 'ส่งงานสำเร็จแล้ว!',
                            text: gasUrl ? 'บันทึกข้อมูลหลักฐานใน Google Sheets และอัปโหลดไฟล์ลง Google Drive สำเร็จ' : 'บันทึกข้อมูลและไฟล์จำลองในแคชเบราว์เซอร์เสร็จสิ้น (โหมดออฟไลน์)',
                            confirmButtonColor: '#2563eb'
                        });

                    } catch (err) {
                        console.error("Submission Upload error: ", err);
                        Swal.fire({
                            icon: 'error',
                            title: 'ล้มเหลว',
                            text: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่ออัปโหลดไฟล์',
                            confirmButtonColor: '#ef4444'
                        });
                    } finally {
                        hideLoading();
                    }
                }
            });
        }

        // Live Google Apps Script Sync Callback to update UI when background fetch completes
        window.onSystemDataSynced = function (syncedData) {
            systemData = syncedData;
            loadMyTasks();
        };

        // DOM Loaded Init Guard
        document.addEventListener('DOMContentLoaded', () => {
            currentUser = getCurrentUser();
            if (!currentUser) {
                window.location.href = 'index.html';
                return;
            }

            // Setup filter buttons
            document.querySelectorAll('.task-filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.task-filter-btn').forEach(b => {
                        b.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
                        b.classList.add('bg-white', 'text-gray-700', 'shadow-sm', 'hover:bg-gray-100');
                    });

                    const target = e.target;
                    target.classList.remove('bg-white', 'text-gray-700', 'shadow-sm', 'hover:bg-gray-100');
                    target.classList.add('bg-blue-600', 'text-white', 'shadow-md');

                    const searchInput = document.getElementById('taskSearchInput');
                    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
                    renderMyTasks(target.getAttribute('data-status'), searchQuery);
                });
            });

            // Setup search input
            const searchInput = document.getElementById('taskSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    const activeFilter = document.querySelector('#myTasksFilter button.bg-blue-600') ? document.querySelector('#myTasksFilter button.bg-blue-600').getAttribute('data-status') : 'all';
                    renderMyTasks(activeFilter, searchInput.value.toLowerCase().trim());
                });
            }

            loadMyTasks();
        });