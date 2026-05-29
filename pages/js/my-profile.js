// Load Profile Details
        function loadMyProfile() {
            if (!currentUser) return;
            document.getElementById('profileName').textContent = currentUser.name;
            document.getElementById('profileRole').textContent = getRoleText(currentUser.role);
            document.getElementById('profileUserId').textContent = `รหัสผู้ใช้: ${currentUser.id}`;

            let userEmail = currentUser.email || '';
            if (!userEmail && currentUser.teacherId) {
                const teacher = systemData.teachers.find(t => t.id === currentUser.teacherId);
                userEmail = teacher ? teacher.email : '';
                currentUser.email = userEmail; // Cache to session
                setCurrentUser(currentUser);
            }
            
            const profileEmailEl = document.getElementById('profileEmail');
            if (userEmail) {
                profileEmailEl.textContent = `อีเมล: ${userEmail}`;
                document.getElementById('profileEmailContainer').classList.remove('hidden');
            } else {
                document.getElementById('profileEmailContainer').classList.add('hidden');
            }


            document.getElementById('changePasswordForm').reset();
        }

        // Change Password Form Validation and Handler
        $('#changePasswordForm').validate({
            rules: {
                confirmNewPassword: {
                    equalTo: "#newPassword"
                }
            },
            messages: {
                confirmNewPassword: {
                    equalTo: "กรุณากรอกรหัสผ่านใหม่ให้ตรงกัน"
                }
            },
            submitHandler: async function(form) {
                const currentPassword = form.currentPassword.value;
                const newPassword = form.newPassword.value;

                try {
                    const hashedCurrent = await hashPassword(currentPassword);

                    if (currentUser.password !== hashedCurrent && currentUser.password !== currentPassword) {
                        Swal.fire({
                            icon: 'error',
                            title: 'เกิดข้อผิดพลาด',
                            text: 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
                            confirmButtonColor: '#ef4444'
                        });
                        return;
                    }

                    showLoading();
                    setTimeout(async () => {
                        try {
                            const hashedNew = await hashPassword(newPassword);
                            const user = systemData.users.find(u => u.id === currentUser.id);
                            if (user) {
                                user.password = hashedNew;
                            }
                            currentUser.password = hashedNew; 
                            setCurrentUser(currentUser); 
                            saveSystemData(systemData);
                            hideLoading();
                            
                            Swal.fire({
                                icon: 'success',
                                title: 'สำเร็จ',
                                text: 'เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว',
                                confirmButtonColor: '#2563eb'
                            });
                            form.reset();
                        } catch (err) {
                            console.error('Password hashing failed', err);
                            hideLoading();
                            Swal.fire('Error', 'ไม่สามารถเข้ารหัสผ่านได้', 'error');
                        }
                    }, 500);
                } catch (err) {
                    console.error('Password validation failed', err);
                    Swal.fire('Error', 'เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน', 'error');
                }
            }
        });



        // Background Google Apps Script sync callback
        window.onSystemDataSynced = function(syncedData) {
            systemData = syncedData;
            loadMyProfile();
        };

        // DOM Initializer
        document.addEventListener('DOMContentLoaded', () => {
            currentUser = getCurrentUser();
            if (!currentUser) {
                window.location.href = 'index.html';
                return;
            }
            loadMyProfile();
        });