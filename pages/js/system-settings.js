// System Settings (Admin only)
        function loadSystemSettings() {
            const settings = systemData.settings || defaultConfig;
            const form = document.getElementById('systemSettingsForm');
            form.systemTitle.value = settings.system_title || '';
            form.schoolName.value = settings.school_name || '';
            form.footerText.value = settings.footer_text || '';
        }

        $('#systemSettingsForm').validate({
            submitHandler: function(form, event) {
                event.preventDefault();
                showLoading();
                setTimeout(async () => {
                    systemData.settings = {
                        ...systemData.settings,
                        system_title: form.systemTitle.value,
                        school_name: form.schoolName.value,
                        footer_text: form.footerText.value,
                        gas_api_url: systemData.settings.gas_api_url
                    };
                    saveSystemData(systemData);
                    applySystemSettings();
                    
                    // Trigger sync to GAS if GAS API URL is set
                    if (systemData.settings.gas_api_url) {
                        await syncDataToGAS(systemData);
                        await syncDataFromGAS();
                    }
                    
                    hideLoading();
                    Swal.fire({
                        icon: 'success',
                        title: 'สำเร็จ',
                        text: 'บันทึกการตั้งค่าเรียบร้อยแล้ว'
                    });
                }, 500);
            }
        });

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            if (!currentUser || currentUser.role !== 'admin') {
                window.location.href = 'dashboard.html';
                return;
            }
            loadSystemSettings();
        });

        window.onSystemDataSynced = function(data) {
            loadSystemSettings();
        };