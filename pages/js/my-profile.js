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

            // Restore user avatar from saved state
            if (currentUser.avatar) {
                document.getElementById('profileAvatar').src = currentUser.avatar;
            } else {
                document.getElementById('profileAvatar').src = `https://i.pravatar.cc/150?u=${currentUser.id}`;
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

        // Profile Avatar Upload and Drive Integration
        document.getElementById('profilePictureInput').addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (!file) return;

            // Validate image file type
            const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif'];
            const extension = file.name.split('.').pop().toLowerCase();
            if (!allowedExtensions.includes(extension)) {
                Swal.fire({
                    icon: 'error',
                    title: 'ข้อผิดพลาด',
                    text: 'กรุณาเลือกเฉพาะไฟล์รูปภาพหลัก (PNG, JPG, JPEG, GIF)',
                    confirmButtonColor: '#ef4444'
                });
                return;
            }

            showLoading();

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                try {
                    const base64Data = reader.result.split(',')[1];
                    const gasUrl = getGasUrl();
                    let finalAvatarUrl;

                    if (gasUrl) {
                        // Real upload to Google Drive using App Script API
                        const uploadedFile = await uploadFileToGAS(`avatar_${currentUser.id}_${Date.now()}.${extension}`, base64Data, file.type);
                        finalAvatarUrl = `https://drive.google.com/uc?export=view&id=${uploadedFile.id}`;
                    } else {
                        // Offline mock fallback: use raw Base64 data-uri locally
                        finalAvatarUrl = reader.result;
                    }

                    // Save to user objects
                    const dbUser = systemData.users.find(u => u.id === currentUser.id);
                    if (dbUser) {
                        dbUser.avatar = finalAvatarUrl;
                    }
                    currentUser.avatar = finalAvatarUrl;
                    
                    setCurrentUser(currentUser);
                    saveSystemData(systemData);

                    // Update UI image
                    document.getElementById('profileAvatar').src = finalAvatarUrl;

                    Swal.fire({
                        icon: 'success',
                        title: 'อัปเดตรูปโปรไฟล์สำเร็จ',
                        text: gasUrl ? 'บันทึกและอัปโหลดรูปภาพลง Google Drive เรียบร้อย' : 'บันทึกรูปภาพเรียบร้อย (โหมดออฟไลน์)',
                        confirmButtonColor: '#2563eb'
                    });

                } catch (err) {
                    console.error("Avatar Upload Error: ", err);
                    Swal.fire({
                        icon: 'error',
                        title: 'อัปเดตรูปโปรไฟล์ล้มเหลว',
                        text: err.message || 'ไม่สามารถอัปโหลดไฟล์รูปภาพได้',
                        confirmButtonColor: '#ef4444'
                    });
                } finally {
                    hideLoading();
                }
            };
            
            reader.onerror = (error) => {
                console.error("FileReader Error: ", error);
                hideLoading();
                Swal.fire({
                    icon: 'error',
                    title: 'ผิดพลาด',
                    text: 'เกิดข้อผิดพลาดในการอ่านไฟล์รูปภาพ',
                    confirmButtonColor: '#ef4444'
                });
            };
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