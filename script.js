// Box Cricket League - Interactive Script

// Tab Switching Functionality (Login / Sign Up)
function switchAuthTab(tab) {
    const loginBtn = document.getElementById('login-tab-btn');
    const signupBtn = document.getElementById('signup-tab-btn');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (!loginBtn || !signupBtn || !loginForm || !signupForm) return;

    // Clear previous error messages
    document.getElementById('login-error-box')?.classList.add('hidden');
    document.getElementById('signup-error-box')?.classList.add('hidden');

    if (tab === 'login') {
        // Activate Login Tab
        loginBtn.classList.add('text-lime-400', 'bg-slate-900', 'shadow-sm');
        loginBtn.classList.remove('text-slate-400', 'hover:text-slate-200');

        signupBtn.classList.remove('text-lime-400', 'bg-slate-900', 'shadow-sm');
        signupBtn.classList.add('text-slate-400', 'hover:text-slate-200');

        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    } else if (tab === 'signup') {
        // Activate Signup Tab
        signupBtn.classList.add('text-lime-400', 'bg-slate-900', 'shadow-sm');
        signupBtn.classList.remove('text-slate-400', 'hover:text-slate-200');

        loginBtn.classList.remove('text-lime-400', 'bg-slate-900', 'shadow-sm');
        loginBtn.classList.add('text-slate-400', 'hover:text-slate-200');

        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    }
}

// Make switchAuthTab accessible globally for inline onclick handlers
window.switchAuthTab = switchAuthTab;

// Modal Manager
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');

    // Restore scrolling if no other modals are open
    const anyModalOpen = document.querySelector('[id$="-modal"]:not(.hidden)');
    if (!anyModalOpen) {
        document.body.style.overflow = '';
    }
}

window.openModal = openModal;
window.closeModal = closeModal;

// Initialize Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Modal Open / Toggle Triggers
    const modalTriggers = document.querySelectorAll('[data-modal-target], [data-modal-toggle]');
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = trigger.getAttribute('data-modal-target') || trigger.getAttribute('data-modal-toggle');
            if (targetId) {
                openModal(targetId);

                // Handle target tab if specified (e.g. data-tab-target="signup")
                const tabTarget = trigger.getAttribute('data-tab-target');
                if (tabTarget) {
                    switchAuthTab(tabTarget);
                }
            }
        });
    });

    // Modal Close Triggers
    const closeButtons = document.querySelectorAll('[data-modal-hide]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-modal-hide');
            if (targetId) {
                closeModal(targetId);
            }
        });
    });

    // Close on backdrop click
    const modals = document.querySelectorAll('#auth-modal, #rules-modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('[id$="-modal"]:not(.hidden)');
            openModals.forEach(m => closeModal(m.id));
        }
    });

    // =========================================================================
    // ATHLETE SESSION & EXPIRATION CONFIGURATION
    // =========================================================================
    // Default short session timeout: 15 minutes (configurable via window.UniBoxConfig)
    const DEFAULT_SHORT_SESSION_DURATION = 15 * 60 * 1000;
    function getShortSessionDuration() {
        return (window.UniBoxConfig && typeof window.UniBoxConfig.SHORT_SESSION_DURATION === 'number')
            ? window.UniBoxConfig.SHORT_SESSION_DURATION
            : DEFAULT_SHORT_SESSION_DURATION;
    }

    let sessionExpiryTimer = null;
    let toastTimeout = null;

    function showSessionToast(msg, type = 'info') {
        const toast = document.getElementById('session-toast');
        const text = document.getElementById('session-toast-text');
        const icon = document.getElementById('session-toast-icon');
        if (!toast || !text) return;

        if (toastTimeout) clearTimeout(toastTimeout);

        text.textContent = msg;
        if (type === 'warning' || type === 'error') {
            toast.className = 'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 transition-all duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl bg-slate-900 border border-amber-400 text-amber-400 text-xs font-bold pointer-events-auto';
            if (icon) icon.textContent = '⏳';
        } else {
            toast.className = 'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 transition-all duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl bg-slate-900 border border-lime-400 text-lime-400 text-xs font-bold pointer-events-auto';
            if (icon) icon.textContent = '✓';
        }

        toastTimeout = setTimeout(() => {
            toast.classList.add('translate-y-20', 'opacity-0');
            toast.classList.remove('pointer-events-auto');
            toast.classList.add('pointer-events-none');
        }, 5000);
    }

    function updateSessionBadge(staySignedIn, expiresAt) {
        const badge = document.getElementById('dash-session-badge');
        const icon = document.getElementById('dash-session-badge-icon');
        const text = document.getElementById('dash-session-badge-text');
        if (!badge || !text) return;

        if (staySignedIn) {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            if (icon) icon.textContent = '🔒';
            text.textContent = 'Stay Signed In: Active';
            badge.classList.remove('hidden');
        } else if (expiresAt) {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20';
            if (icon) icon.textContent = '⏳';
            const remainingMs = Math.max(0, expiresAt - Date.now());
            const mins = Math.max(1, Math.round(remainingMs / 60000));
            text.textContent = `Temporary Session (~${mins}m left)`;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    function handleSessionExpired(reason = 'Your temporary session has expired. Check "Stay signed in" to keep your session active.') {
        exitDashboard();
        showSessionToast(reason, 'warning');
        openModal('auth-modal');
        switchAuthTab('login');
        const errorBox = document.getElementById('login-error-box');
        const errorText = document.getElementById('login-error-text');
        if (errorBox && errorText) {
            errorText.textContent = reason;
            errorBox.classList.remove('hidden');
        }
    }

    // Enter Dashboard & Show Top Navigation Logout Button
    function enterDashboard(user, staySignedIn = true, existingExpiresAt = null) {
        // Add logged-in class to html root to guarantee zero visual flash
        document.documentElement.classList.add('is-athlete-logged-in');

        // Clear any previous expiry timer
        if (sessionExpiryTimer) {
            clearTimeout(sessionExpiryTimer);
            sessionExpiryTimer = null;
        }

        const isStaySignedIn = Boolean(staySignedIn);
        let expiresAt = null;

        if (!isStaySignedIn) {
            expiresAt = existingExpiresAt || (Date.now() + getShortSessionDuration());
        }

        // 1. Persist student session and profile
        if (user && user.email) {
            const athleteName = user.name || user.full_name || '';
            const sessionData = {
                email: user.email,
                name: athleteName,
                staySignedIn: isStaySignedIn,
                loginTimestamp: Date.now(),
                expiresAt: expiresAt
            };
            localStorage.setItem('unibox_student_session', JSON.stringify(sessionData));
            localStorage.setItem('unibox_cached_profile', JSON.stringify(user));
            sessionStorage.setItem('unibox_active_email', user.email);
            sessionStorage.setItem('unibox_session_active', '1');
        }

        // Setup timer if temporary session
        if (!isStaySignedIn && expiresAt) {
            const remaining = Math.max(0, expiresAt - Date.now());
            if (remaining === 0) {
                handleSessionExpired();
                return;
            }
            sessionExpiryTimer = setTimeout(() => {
                handleSessionExpired('Your temporary session has expired. Check "Stay signed in" to keep your session active.');
            }, remaining);
        }

        // Update session badge indicator on player dashboard
        updateSessionBadge(isStaySignedIn, expiresAt);

        // 2. Hide navbar Login button & show navbar Logout button
        const navLoginBtn = document.getElementById('nav-login-btn');
        if (navLoginBtn) navLoginBtn.classList.add('hidden');

        const navLogoutBtn = document.getElementById('nav-logout-btn');
        if (navLogoutBtn) navLogoutBtn.classList.remove('hidden');

        // 3. Close the Auth modal cleanly
        closeModal('auth-modal');
        const modalElement = document.getElementById('auth-modal');
        if (modalElement) {
            modalElement.classList.add('hidden');
            modalElement.classList.remove('flex');
        }
        document.querySelector('[modal-backdrop]')?.remove();
        document.body.classList.remove('overflow-hidden');
        document.body.style.overflow = '';

        // 4. Hide landing hero section and reveal the dashboard
        document.querySelector('main')?.classList.add('hidden');
        const dashboard = document.getElementById('player-dashboard');
        if (dashboard) {
            dashboard.classList.remove('hidden');
        }

        // Scroll to top to ensure athlete immediately views dashboard
        window.scrollTo({ top: 0, behavior: 'instant' });

        // Synchronize browser history / URL hash to #dashboard
        if (window.location.hash !== '#dashboard') {
            try {
                history.replaceState(null, '', '#dashboard');
            } catch (e) {}
        }

        // 5. Update clearance status badge based on admin's decision (Approved / Rejected / Pending)
        updateDashboardClearanceBadge(user?.status || 'Registered');

        // Re-fetch latest clearance and auction decision live from database
        const userEmail = user?.email || sessionStorage.getItem('unibox_active_email');
        if (userEmail && window.UniBoxDb) {
            window.UniBoxDb.getPlayerByEmail(userEmail).then(({ data: freshPlayer }) => {
                if (freshPlayer) {
                    applyProfileToUI(freshPlayer);
                }
            });
        }
    }

    // Dynamic Dashboard Clearance Badge Renderer
    function updateDashboardClearanceBadge(status) {
        const badge = document.getElementById('dash-clearance-status');
        if (!badge) return;

        if (status === 'Approved') {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20';
            badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Approved`;
        } else if (status === 'Rejected') {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-400/10 text-rose-400 border border-rose-400/20';
            badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Rejected`;
        } else {
            badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20';
            badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Pending Approval`;
        }
    }

    // Exit Dashboard & Restore Top Navigation Login Button
    function exitDashboard() {
        if (sessionExpiryTimer) {
            clearTimeout(sessionExpiryTimer);
            sessionExpiryTimer = null;
        }

        // Clear saved athlete session so page returns to default
        document.documentElement.classList.remove('is-athlete-logged-in');
        localStorage.removeItem('unibox_student_session');
        localStorage.removeItem('unibox_cached_profile');
        sessionStorage.removeItem('unibox_active_email');
        sessionStorage.removeItem('unibox_session_active');

        // Hide session badge
        const badge = document.getElementById('dash-session-badge');
        if (badge) badge.classList.add('hidden');

        // 1. Restore landing hero layouts and hide dashboard
        document.querySelector('main')?.classList.remove('hidden');
        document.getElementById('player-dashboard')?.classList.add('hidden');

        // 2. Show navbar Login button & hide navbar Logout button
        const navLoginBtn = document.getElementById('nav-login-btn');
        if (navLoginBtn) navLoginBtn.classList.remove('hidden');

        const navLogoutBtn = document.getElementById('nav-logout-btn');
        if (navLogoutBtn) navLogoutBtn.classList.add('hidden');

        // 3. Clear URL hash if at #dashboard and reset scroll
        if (window.location.hash === '#dashboard') {
            try {
                history.replaceState(null, '', window.location.pathname);
            } catch (e) {}
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    // Form Submissions
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email')?.value?.trim() || '';
            const password = document.getElementById('login-password')?.value || '';
            const staySignedInCheckbox = document.getElementById('login-stay-signed-in');
            const staySignedIn = Boolean(staySignedInCheckbox?.checked);
            const errorBox = document.getElementById('login-error-box');
            const errorText = document.getElementById('login-error-text');

            if (errorBox) errorBox.classList.add('hidden');

            const fallbackName = email ? email.split('@')[0] : 'Registered Athlete';
            let userProfile = { name: fallbackName, email, status: 'Registered' };

            // Fetch existing player record from database (Supabase / localStorage)
            if (window.UniBoxDb) {
                const { data: dbPlayer } = await window.UniBoxDb.getPlayerByEmail(email);

                if (!dbPlayer) {
                    if (errorBox && errorText) {
                        errorText.textContent = 'No registered athlete found with this email. Please sign up first.';
                        errorBox.classList.remove('hidden');
                    }
                    return;
                }

                // Verify Hashed Password Credential
                if (dbPlayer.password_hash) {
                    const inputHash = await window.UniBoxDb.hashPassword(password);
                    if (dbPlayer.password_hash !== inputHash) {
                        if (errorBox && errorText) {
                            errorText.textContent = 'Incorrect password. Please verify credentials.';
                            errorBox.classList.remove('hidden');
                        }
                        return;
                    }
                }

                userProfile = {
                    name: dbPlayer.full_name || dbPlayer.name || fallbackName,
                    full_name: dbPlayer.full_name || dbPlayer.name || fallbackName,
                    email: dbPlayer.email,
                    enrollment_no: dbPlayer.enrollment_no || '---',
                    department: dbPlayer.department || '---',
                    gender: dbPlayer.gender || '---',
                    player_role: dbPlayer.player_role || '---',
                    certificate: dbPlayer.certificate_name || dbPlayer.certificate || 'None attached',
                    certificate_name: dbPlayer.certificate_name || dbPlayer.certificate || 'None attached',
                    certificate_data: dbPlayer.certificate_data || null,
                    photo_data: dbPlayer.photo_data || null,
                    status: dbPlayer.status || 'Registered',
                    base_price: dbPlayer.base_price,
                    sold_price: dbPlayer.sold_price,
                    sold_to_team: dbPlayer.sold_to_team,
                    sold_to_team_id: dbPlayer.sold_to_team_id,
                    auction_status: dbPlayer.auction_status
                };

                // Populate credentials table & auction status
                applyProfileToUI(userProfile);
            }

            sessionStorage.setItem('unibox_active_email', email);
            enterDashboard(userProfile, staySignedIn);
            loginForm.reset();
            if (staySignedInCheckbox) staySignedInCheckbox.checked = false;
        });
    }

    // ==============================================================================
    // Password Visibility Toggles
    // ==============================================================================
    function setupPasswordToggle(inputId, buttonId, iconId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);
        const icon = document.getElementById(iconId);
        if (!input || !button) return;

        button.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';

            if (icon) {
                if (isPassword) {
                    // Show "Eye Off / Slash" icon
                    icon.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    `;
                    icon.classList.add('text-sky-400');
                    icon.classList.remove('text-slate-400');
                } else {
                    // Show standard "Eye" icon
                    icon.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    `;
                    icon.classList.remove('text-sky-400');
                    icon.classList.add('text-slate-400');
                }
            }
        });
    }

    setupPasswordToggle('login-password', 'toggle-login-password', 'toggle-login-password-icon');
    setupPasswordToggle('signup-password', 'toggle-signup-password', 'toggle-signup-password-icon');

    // ==============================================================================
    // Athlete Signup Validation & Real-time Sanitizers
    // ==============================================================================
    const nameInput = document.getElementById('signup-name');
    const enrollmentInput = document.getElementById('signup-enrollment');
    const phoneInput = document.getElementById('signup-phone');
    const deptInput = document.getElementById('signup-department');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const photoInputSignup = document.getElementById('signup-photo');
    const certInput = document.getElementById('signup-certificate');

    // Inline error helpers
    const showFieldError = (inputId, errorId, message) => {
        const input = document.getElementById(inputId);
        const errorEl = document.getElementById(errorId);
        if (input) {
            input.classList.add('border-rose-500', 'focus:border-rose-500');
            input.classList.remove('border-sky-950', 'border-sky-500');
        }
        if (errorEl) {
            if (message) errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    };

    const clearFieldError = (inputId, errorId) => {
        const input = document.getElementById(inputId);
        const errorEl = document.getElementById(errorId);
        if (input) {
            input.classList.remove('border-rose-500', 'focus:border-rose-500');
        }
        if (errorEl) {
            errorEl.classList.add('hidden');
        }
    };

    // Realtime field sanitizers & listeners
    if (nameInput) {
        // Intercept invalid characters before insertion where supported
        nameInput.addEventListener('beforeinput', (e) => {
            if (e.data && /[^A-Za-zÀ-ÿ' -]/.test(e.data)) {
                e.preventDefault();
                showFieldError('signup-name', 'signup-name-error', 'Full Name can only contain letters, spaces, hyphens and apostrophes (no numbers or special characters).');
            }
        });

        // Intercept keys directly (prevent numbers, emojis, symbols from ever appearing)
        nameInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) return;
            if (/[0-9]/.test(e.key)) {
                e.preventDefault();
                showFieldError('signup-name', 'signup-name-error', 'Numbers are strictly not allowed in Full Name.');
                return;
            }
            if (!/^[A-Za-zÀ-ÿ' -]$/.test(e.key)) {
                e.preventDefault();
                showFieldError('signup-name', 'signup-name-error', 'Special characters, numbers, and emojis are not allowed in Full Name.');
                return;
            }
        });

        // Input-level filtering while typing & pasting
        nameInput.addEventListener('input', () => {
            const raw = nameInput.value;
            const hadDisallowed = /[^A-Za-zÀ-ÿ' -]/.test(raw);
            const filtered = raw
                .replace(/[^A-Za-zÀ-ÿ' -]/g, '')
                .replace(/\s{2,}/g, ' ');

            if (raw !== filtered) {
                nameInput.value = filtered;
            }

            if (hadDisallowed) {
                showFieldError('signup-name', 'signup-name-error', 'Numbers and special characters were removed from Full Name.');
            } else if (filtered.trim().length >= 2) {
                clearFieldError('signup-name', 'signup-name-error');
            }
        });

        nameInput.addEventListener('paste', (e) => {
            const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
            if (/[^A-Za-zÀ-ÿ' -]/.test(text)) {
                showFieldError('signup-name', 'signup-name-error', 'Numbers and special characters in pasted text were automatically removed.');
            }
        });

        nameInput.addEventListener('blur', () => {
            nameInput.value = nameInput.value.trim().replace(/\s{2,}/g, ' ');
            if (nameInput.value.length >= 2) {
                clearFieldError('signup-name', 'signup-name-error');
            }
        });
    }

    if (enrollmentInput) {
        enrollmentInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
            clearFieldError('signup-enrollment', 'signup-enrollment-error');
        });
    }

    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            // Strictly enforce digits only and maximum 10 digits
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
            clearFieldError('signup-phone', 'signup-phone-error');
        });
    }

    if (deptInput) {
        deptInput.addEventListener('change', () => {
            clearFieldError('signup-department', 'signup-department-error');
        });
    }

    if (emailInput) {
        emailInput.addEventListener('input', () => {
            clearFieldError('signup-email', 'signup-email-error');
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            clearFieldError('signup-password', 'signup-password-error');
        });
    }

    // Athlete Photo Upload in Signup with Live Preview
    let pendingSignupPhotoData = null;
    if (photoInputSignup) {
        const previewImg = document.getElementById('signup-photo-preview');
        const placeholder = document.getElementById('signup-photo-placeholder');
        const filenameLabel = document.getElementById('signup-photo-filename');

        photoInputSignup.addEventListener('change', () => {
            clearFieldError('signup-photo', 'signup-photo-error');
            if (photoInputSignup.files && photoInputSignup.files.length > 0) {
                const file = photoInputSignup.files[0];
                const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
                if (!validTypes.includes(file.type)) {
                    showFieldError('signup-photo', 'signup-photo-error', 'Unsupported image format. Please select JPG, PNG, or WEBP.');
                    photoInputSignup.value = '';
                    pendingSignupPhotoData = null;
                    if (previewImg) previewImg.classList.add('hidden');
                    if (placeholder) placeholder.classList.remove('hidden');
                    if (filenameLabel) filenameLabel.textContent = 'Choose Athlete Photo...';
                    return;
                }

                if (file.size > 2 * 1024 * 1024) {
                    showFieldError('signup-photo', 'signup-photo-error', 'Photo exceeds 2MB limit. Please upload a smaller image.');
                    photoInputSignup.value = '';
                    pendingSignupPhotoData = null;
                    if (previewImg) previewImg.classList.add('hidden');
                    if (placeholder) placeholder.classList.remove('hidden');
                    if (filenameLabel) filenameLabel.textContent = 'Choose Athlete Photo...';
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    pendingSignupPhotoData = e.target.result;
                    if (previewImg) {
                        previewImg.src = e.target.result;
                        previewImg.classList.remove('hidden');
                    }
                    if (placeholder) placeholder.classList.add('hidden');
                    if (filenameLabel) {
                        const sizeKb = (file.size / 1024).toFixed(0);
                        filenameLabel.textContent = `📷 ${file.name} (${sizeKb} KB)`;
                        filenameLabel.classList.add('text-sky-400');
                    }
                };
                reader.readAsDataURL(file);
            } else {
                pendingSignupPhotoData = null;
                if (previewImg) previewImg.classList.add('hidden');
                if (placeholder) placeholder.classList.remove('hidden');
                if (filenameLabel) {
                    filenameLabel.textContent = 'Choose Athlete Photo...';
                    filenameLabel.classList.remove('text-sky-400');
                }
            }
        });
    }

    // Certificate Upload Display & Data URL Conversion with Strict MIME & Size Validation
    let pendingCertData = null;
    let pendingCertName = null;
    const certFileName = document.getElementById('certificate-filename');
    if (certInput && certFileName) {
        certInput.addEventListener('change', () => {
            clearFieldError('signup-certificate', 'signup-cert-error');
            if (certInput.files && certInput.files.length > 0) {
                const file = certInput.files[0];
                const validMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
                const isPdfOrImage = validMimes.includes(file.type) || file.name.match(/\.(pdf|jpe?g|png|webp)$/i);

                if (!isPdfOrImage) {
                    showFieldError('signup-certificate', 'signup-cert-error', 'Unsupported file type. Please upload a PDF, JPG, PNG, or WEBP.');
                    certInput.value = '';
                    pendingCertData = null;
                    pendingCertName = null;
                    certFileName.textContent = 'Upload Certificate / Proof';
                    certFileName.classList.remove('text-lime-400', 'text-sky-400');
                    return;
                }

                if (file.size > 5 * 1024 * 1024) {
                    showFieldError('signup-certificate', 'signup-cert-error', 'File size exceeds 5MB limit. Please upload a smaller document.');
                    certInput.value = '';
                    pendingCertData = null;
                    pendingCertName = null;
                    certFileName.textContent = 'Upload Certificate / Proof';
                    certFileName.classList.remove('text-lime-400', 'text-sky-400');
                    return;
                }

                const sizeKb = (file.size / 1024).toFixed(1);
                pendingCertName = file.name;
                certFileName.textContent = `📎 ${file.name} (${sizeKb} KB)`;
                certFileName.classList.add('text-lime-400');

                const reader = new FileReader();
                reader.onload = (e) => {
                    pendingCertData = e.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                pendingCertData = null;
                pendingCertName = null;
                certFileName.textContent = 'Upload Certificate / Proof';
                certFileName.classList.remove('text-lime-400');
            }
        });
    }

    // Dynamic Profile Registration Router Handler with Strict Validation & Verified Dashboard Redirect
    async function handleRegistration(e) {
        if (e) e.preventDefault();

        const submitBtn = document.getElementById('signup-submit-btn');
        const signupErrorBox = document.getElementById('signup-error-box');
        const signupErrorText = document.getElementById('signup-error-text');
        if (signupErrorBox) signupErrorBox.classList.add('hidden');

        // Reset previous field errors
        ['signup-name', 'signup-enrollment', 'signup-phone', 'signup-department', 'signup-email', 'signup-password', 'signup-photo', 'signup-certificate'].forEach(id => {
            const errId = id === 'signup-certificate' ? 'signup-cert-error' : `${id}-error`;
            clearFieldError(id, errId);
        });

        // 1. Full Name Validation: Text only (letters, spaces, hyphens, apostrophes), 2-100 chars
        const rawName = document.getElementById('signup-name')?.value || '';
        const sanitizedName = rawName
            .replace(/[^A-Za-zÀ-ÿ' -]/g, '')
            .replace(/\s{2,}/g, ' ');
        const trimmedName = sanitizedName.trim();

        if (/[0-9]/.test(rawName)) {
            showFieldError('signup-name', 'signup-name-error', 'Full Name cannot contain numbers. Numbers are strictly disallowed.');
            document.getElementById('signup-name')?.focus();
            return;
        }

        if (/[^A-Za-zÀ-ÿ' -]/.test(rawName)) {
            showFieldError('signup-name', 'signup-name-error', 'Full Name can only contain letters, spaces, hyphens and apostrophes (no numbers or special characters).');
            document.getElementById('signup-name')?.focus();
            return;
        }

        if (!trimmedName || trimmedName.length < 2) {
            showFieldError('signup-name', 'signup-name-error', 'Full Name is required (minimum 2 characters).');
            document.getElementById('signup-name')?.focus();
            return;
        }

        if (trimmedName.length > 100) {
            showFieldError('signup-name', 'signup-name-error', 'Full Name must not exceed 100 characters.');
            document.getElementById('signup-name')?.focus();
            return;
        }

        const nameRegex = /^[A-Za-zÀ-ÿ]+([ A-Za-zÀ-ÿ'-]*[A-Za-zÀ-ÿ]+)*$/;
        if (!nameRegex.test(trimmedName)) {
            showFieldError('signup-name', 'signup-name-error', 'Please enter a valid full name (letters, spaces, hyphens and apostrophes only).');
            document.getElementById('signup-name')?.focus();
            return;
        }

        // 2. Enrollment Number Validation: Alphanumeric, hyphens/slashes, 4-25 chars
        const rawEnrollment = document.getElementById('signup-enrollment')?.value || '';
        const cleanEnrollment = rawEnrollment.trim().toUpperCase();
        const enrollmentRegex = /^[A-Z0-9\/-]{4,25}$/;

        if (!cleanEnrollment || !enrollmentRegex.test(cleanEnrollment)) {
            showFieldError('signup-enrollment', 'signup-enrollment-error', 'Enrollment Number must be 4–25 alphanumeric characters (letters, numbers, hyphens or slashes only).');
            document.getElementById('signup-enrollment')?.focus();
            return;
        }

        // 3. Phone Number Validation: Exactly 10 digits for Indian mobile numbers
        const rawPhone = document.getElementById('signup-phone')?.value || '';
        const cleanPhone = rawPhone.replace(/\D/g, '');

        if (!cleanPhone || cleanPhone.length !== 10) {
            showFieldError('signup-phone', 'signup-phone-error', 'Please enter a valid 10-digit mobile number (digits only, no spaces or special characters).');
            document.getElementById('signup-phone')?.focus();
            return;
        }

        // 4. Branch / Department Validation: Strictly BCA, B.Tech, or BBA only
        const deptSelect = document.getElementById('signup-department');
        const deptText = deptSelect ? (deptSelect.options[deptSelect.selectedIndex]?.value || '') : '';
        const VALID_BRANCHES = ['BCA', 'B.Tech', 'BBA'];

        if (!deptText || !VALID_BRANCHES.includes(deptText)) {
            showFieldError('signup-department', 'signup-department-error', 'Please select an authorized tournament branch (BCA, B.Tech, or BBA).');
            deptSelect?.focus();
            return;
        }

        // 5. Email ID Validation: Valid standard email format
        const rawEmail = document.getElementById('signup-email')?.value || '';
        const cleanEmail = rawEmail.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

        if (!cleanEmail || !emailRegex.test(cleanEmail)) {
            showFieldError('signup-email', 'signup-email-error', 'Please enter a valid email address (e.g., student@university.edu).');
            document.getElementById('signup-email')?.focus();
            return;
        }

        // 6. Password Validation: Minimum 8 characters
        const rawPassword = document.getElementById('signup-password')?.value || '';
        if (!rawPassword || rawPassword.length < 8) {
            showFieldError('signup-password', 'signup-password-error', 'Password must be at least 8 characters long.');
            document.getElementById('signup-password')?.focus();
            return;
        }

        // 7. Gender Validation: Controlled radio options
        const genderVal = signupForm?.querySelector('input[name="gender"]:checked')?.value || 'Male';
        const VALID_GENDERS = ['Male', 'Female', 'Other'];
        if (!VALID_GENDERS.includes(genderVal)) {
            if (signupErrorBox && signupErrorText) {
                signupErrorText.textContent = 'Please select a valid gender option.';
                signupErrorBox.classList.remove('hidden');
                signupErrorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return;
        }

        // 8. Role Validation: Controlled radio options
        const selectedRole = signupForm?.querySelector('input[name="player_role"]:checked')?.value || 'All-Rounder';
        const VALID_ROLES = ['All-Rounder', 'Batter', 'Bowler', 'Keeper', 'Wicketkeeper', 'Fielder'];
        if (!VALID_ROLES.includes(selectedRole)) {
            if (signupErrorBox && signupErrorText) {
                signupErrorText.textContent = 'Please select a valid playing role.';
                signupErrorBox.classList.remove('hidden');
                signupErrorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return;
        }
        const normalizedRole = selectedRole === 'Keeper' ? 'Wicketkeeper' : selectedRole;

        // Visual loading state on register button
        const originalBtnHTML = submitBtn ? submitBtn.innerHTML : 'Register & Join Arena';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
            submitBtn.innerHTML = `
                <div class="flex items-center justify-center gap-2">
                    <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Registering Athlete...</span>
                </div>
            `;
        }

        try {
            // 9. Read certificate file asynchronously if submitted right after selection
            const certFile = certInput?.files?.[0];
            if (certFile && !pendingCertData) {
                pendingCertData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve(ev.target.result);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(certFile);
                });
                pendingCertName = certFile.name;
            }

            // Hash password securely (never logged to console)
            const passwordHash = window.UniBoxDb ? await window.UniBoxDb.hashPassword(rawPassword) : rawPassword;
            const defaultBase = window.UniBoxDb ? window.UniBoxDb.getDefaultBasePriceForRole(normalizedRole) : 15;
            const certDisplayStr = pendingCertName ? `📎 ${pendingCertName}` : 'None attached';

            const playerData = {
                name: trimmedName,
                full_name: trimmedName,
                enrollment_no: cleanEnrollment,
                phone: cleanPhone,
                department: deptText,
                email: cleanEmail,
                gender: genderVal,
                player_role: normalizedRole,
                base_price: defaultBase,
                auction_status: 'Upcoming',
                certificate: certDisplayStr,
                certificate_name: certDisplayStr,
                certificate_data: pendingCertData,
                photo_data: pendingSignupPhotoData,
                password_hash: passwordHash,
                status: 'Registered'
            };

            // 10. Persist to Database (Supabase / local fallback)
            let finalProfile = playerData;
            if (window.UniBoxDb) {
                const dbResult = await window.UniBoxDb.savePlayer(playerData);
                if (dbResult.error || !dbResult.data) {
                    const errMsg = (dbResult.error?.code === '23505' || dbResult.error?.message?.includes('unique') || dbResult.error?.message?.includes('duplicate key'))
                        ? 'An athlete with this email or enrollment number already exists.'
                        : (dbResult.error?.message || 'Registration failed. Please check details and try again.');
                    
                    if (signupErrorBox && signupErrorText) {
                        signupErrorText.textContent = errMsg;
                        signupErrorBox.classList.remove('hidden');
                        signupErrorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                    return;
                }
                finalProfile = { ...playerData, ...dbResult.data };
                finalProfile.name = finalProfile.name || finalProfile.full_name || trimmedName;
                finalProfile.full_name = finalProfile.full_name || finalProfile.name || trimmedName;
                finalProfile.phone = finalProfile.phone || cleanPhone;
            }

            // Immediately trigger hero athlete count synchronization
            if (typeof syncAthleteCount === 'function') {
                syncAthleteCount();
            }

            // 11. Authentication & Session Creation
            const sessionData = {
                email: finalProfile.email,
                name: finalProfile.name || finalProfile.full_name || trimmedName,
                staySignedIn: true,
                loginTimestamp: Date.now(),
                expiresAt: null
            };
            localStorage.setItem('unibox_student_session', JSON.stringify(sessionData));
            localStorage.setItem('unibox_cached_profile', JSON.stringify(finalProfile));
            sessionStorage.setItem('unibox_active_email', finalProfile.email);
            sessionStorage.setItem('unibox_session_active', '1');

            // 12. Session Verification
            const verifySession = localStorage.getItem('unibox_student_session');
            const verifyEmail = sessionStorage.getItem('unibox_active_email');
            if (!verifySession || !verifyEmail) {
                throw new Error('Session verification check failed after registration.');
            }

            // 13. Populate all profile and auction fields on the dashboard
            applyProfileToUI(finalProfile);

            // 14. Switch to dashboard view, close modal & redirect
            enterDashboard(finalProfile, true);
            updateCertViewerButton(playerData.certificate, playerData.certificate_data);

            // 15. Clean reset form & state
            signupForm.reset();
            pendingCertData = null;
            pendingCertName = null;
            pendingSignupPhotoData = null;
            if (certFileName) {
                certFileName.textContent = 'Upload Certificate / Proof';
                certFileName.classList.remove('text-lime-400');
            }
            const previewImg = document.getElementById('signup-photo-preview');
            const placeholder = document.getElementById('signup-photo-placeholder');
            const filenameLabel = document.getElementById('signup-photo-filename');
            if (previewImg) previewImg.classList.add('hidden');
            if (placeholder) placeholder.classList.remove('hidden');
            if (filenameLabel) {
                filenameLabel.textContent = 'Choose Athlete Photo...';
                filenameLabel.classList.remove('text-sky-400');
            }

            showSessionToast('Registration successful! Welcome to your Player Dashboard.', 'success');

        } catch (err) {
            console.error('[REGISTRATION] Exception during registration flow:', err);
            if (signupErrorBox && signupErrorText) {
                signupErrorText.textContent = err?.message || 'An unexpected error occurred during registration.';
                signupErrorBox.classList.remove('hidden');
                signupErrorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
                submitBtn.innerHTML = originalBtnHTML;
            }
        }
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleRegistration);
    }
    window.handleRegistration = handleRegistration;

    // Dashboard Player Photo Upload Handler with Inline Notification
    const photoInput = document.getElementById('dash-photo-input');
    const playerPhoto = document.getElementById('dash-player-photo');
    const photoPlaceholder = document.getElementById('dash-photo-placeholder');
    const photoStatusBadge = document.getElementById('photo-status-badge');
    const photoBtnText = document.getElementById('photo-btn-text');

    if (photoInput && playerPhoto) {
        photoInput.addEventListener('change', () => {
            if (photoInput.files && photoInput.files.length > 0) {
                const file = photoInput.files[0];
                const validTypes = ['image/jpeg', 'image/png', 'image/webp'];

                if (!validTypes.includes(file.type)) {
                    if (photoBtnText) {
                        const orig = photoBtnText.textContent;
                        photoBtnText.textContent = '⚠️ Invalid file type';
                        setTimeout(() => { photoBtnText.textContent = orig; }, 3000);
                    }
                    return;
                }

                if (file.size > 2 * 1024 * 1024) {
                    if (photoBtnText) {
                        const orig = photoBtnText.textContent;
                        photoBtnText.textContent = '⚠️ Max 2MB allowed';
                        setTimeout(() => { photoBtnText.textContent = orig; }, 3000);
                    }
                    return;
                }

                const reader = new FileReader();
                reader.onload = async (e) => {
                    playerPhoto.src = e.target.result;
                    playerPhoto.classList.remove('hidden');
                    if (photoPlaceholder) photoPlaceholder.classList.add('hidden');
                    if (photoStatusBadge) {
                        photoStatusBadge.classList.remove('hidden');
                        photoStatusBadge.classList.add('flex');
                    }
                    if (photoBtnText) photoBtnText.textContent = 'Change Photo';

                    // Persist photo to database for active player
                    const activeEmail = sessionStorage.getItem('unibox_active_email') || document.getElementById('dash-player-email')?.innerText;
                    if (activeEmail && activeEmail !== '---' && window.UniBoxDb) {
                        await window.UniBoxDb.updatePlayerPhoto(activeEmail, e.target.result);
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 6. Bind standard user logout button behavior controls (both in dashboard & header)
    document.getElementById('logout-btn')?.addEventListener('click', exitDashboard);
    document.getElementById('nav-logout-btn')?.addEventListener('click', exitDashboard);

    // Helper to immediately apply player profile to UI elements
    function applyProfileToUI(profile) {
        if (!profile) return;
        const setInnerText = (id, val) => {
            const el = document.getElementById(id);
            if (el && val) el.innerText = val;
        };
        setInnerText('dash-player-name', profile.name || profile.full_name);
        setInnerText('dash-player-name-full', profile.name || profile.full_name);
        setInnerText('dash-player-email', profile.email);
        setInnerText('dash-player-phone', profile.phone || '---');
        setInnerText('dash-player-roll', profile.enrollment_no);
        setInnerText('dash-player-roll-detail', profile.enrollment_no);
        setInnerText('dash-player-dept', profile.department);
        setInnerText('dash-player-dept-detail', profile.department);
        setInnerText('dash-player-gender', profile.gender);
        setInnerText('dash-player-gender-detail', profile.gender);
        setInnerText('dash-player-role', profile.player_role);
        setInnerText('dash-player-role-detail', profile.player_role);
        setInnerText('dash-player-cert', profile.certificate || profile.certificate_name);

        updateCertViewerButton(profile.certificate || profile.certificate_name, profile.certificate_data);

        // Render Auction Base Price and Sold Status
        const role = profile.player_role || 'All-Rounder';
        const defaultRoleBasePrice = window.UniBoxDb ? window.UniBoxDb.getDefaultBasePriceForRole(role) : 15;
        const basePrice = (profile.base_price !== undefined && profile.base_price !== null && profile.base_price !== '') 
            ? Number(profile.base_price) 
            : defaultRoleBasePrice;
        setInnerText('dash-player-base-price', `${basePrice.toFixed(1)} Pts`);

        const auctionStatusContainer = document.getElementById('dash-auction-status-container');
        if (auctionStatusContainer) {
            const isSold = profile.auction_status === 'Sold' || Boolean(profile.sold_to_team);
            if (isSold) {
                const soldPrice = profile.sold_price !== undefined ? Number(profile.sold_price) : basePrice;
                auctionStatusContainer.innerHTML = `
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-400/10 text-emerald-400 border border-emerald-400/30">
                        <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Sold to ${profile.sold_to_team} (${soldPrice.toFixed(1)} Pts)
                    </span>
                `;
            } else {
                auctionStatusContainer.innerHTML = `
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-950 text-slate-400 border border-slate-800">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Available for Bidding
                    </span>
                `;
            }
        }

        if (profile.photo_data) {
            const playerPhoto = document.getElementById('dash-player-photo');
            const photoPlaceholder = document.getElementById('dash-photo-placeholder');
            const photoStatusBadge = document.getElementById('photo-status-badge');
            const photoBtnText = document.getElementById('photo-btn-text');
            if (playerPhoto) {
                playerPhoto.src = profile.photo_data;
                playerPhoto.classList.remove('hidden');
            }
            if (photoPlaceholder) photoPlaceholder.classList.add('hidden');
            if (photoStatusBadge) {
                photoStatusBadge.classList.remove('hidden');
                photoStatusBadge.classList.add('flex');
            }
            if (photoBtnText) photoBtnText.textContent = 'Change Photo';
        }
        updateDashboardClearanceBadge(profile.status || 'Registered');
    }

    // 7. Auto-Restore Student Session on Page Load / Refresh (0ms Zero-Flicker)
    async function restoreStudentSession() {
        const savedSessionRaw = localStorage.getItem('unibox_student_session');
        if (!savedSessionRaw) return;

        try {
            const session = JSON.parse(savedSessionRaw);
            if (!session || !session.email) return;

            // Enforce temporary session checks if "Stay signed in" was NOT checked
            if (session.staySignedIn === false) {
                // Check 1: Was the browser / tab closed?
                const isTabActive = sessionStorage.getItem('unibox_session_active') === '1';
                if (!isTabActive) {
                    console.log('Temporary session ended: browser tab was closed.');
                    exitDashboard();
                    return;
                }

                // Check 2: Has the short session expired?
                if (session.expiresAt && Date.now() > session.expiresAt) {
                    console.log('Temporary session expired after timeout.');
                    handleSessionExpired('Your temporary session has expired. Check "Stay signed in" to keep your session active.');
                    return;
                }
            }

            const email = session.email;
            const isStaySignedIn = session.staySignedIn !== false;
            const expiresAt = session.expiresAt || null;

            // Phase 1: Immediately render cached profile (0ms, zero lag!)
            const cachedProfileRaw = localStorage.getItem('unibox_cached_profile');
            if (cachedProfileRaw) {
                try {
                    const cached = JSON.parse(cachedProfileRaw);
                    if (cached && cached.email === email) {
                        applyProfileToUI(cached);
                        enterDashboard(cached, isStaySignedIn, expiresAt);
                    }
                } catch (e) {}
            }

            // Phase 2: Asynchronously fetch latest data from database in background
            let userProfile = { name: session.name || email.split('@')[0], email, status: 'Registered' };
            if (window.UniBoxDb) {
                const { data: dbPlayer } = await window.UniBoxDb.getPlayerByEmail(email);
                if (dbPlayer) {
                    userProfile = {
                        name: dbPlayer.full_name || dbPlayer.name || userProfile.name,
                        email: dbPlayer.email,
                        enrollment_no: dbPlayer.enrollment_no || '---',
                        department: dbPlayer.department || '---',
                        gender: dbPlayer.gender || '---',
                        player_role: dbPlayer.player_role || '---',
                        certificate: dbPlayer.certificate_name || dbPlayer.certificate || 'None attached',
                        certificate_name: dbPlayer.certificate_name || dbPlayer.certificate || 'None attached',
                        certificate_data: dbPlayer.certificate_data || localStorage.getItem(`unibox_cert_${email}`) || null,
                        photo_data: dbPlayer.photo_data || null,
                        status: dbPlayer.status || 'Registered',
                        base_price: dbPlayer.base_price,
                        sold_price: dbPlayer.sold_price,
                        sold_to_team: dbPlayer.sold_to_team,
                        sold_to_team_id: dbPlayer.sold_to_team_id,
                        auction_status: dbPlayer.auction_status
                    };

                    applyProfileToUI(userProfile);
                    enterDashboard(userProfile, isStaySignedIn, expiresAt);
                }
            }
        } catch (err) {
            console.warn('Session restoration error:', err);
        }
    }

    // Certificate Viewer Logic & State
    let currentAthleteCert = { name: null, data: null };

    function updateCertViewerButton(certName, certData) {
        const activeEmail = sessionStorage.getItem('unibox_active_email') || document.getElementById('dash-player-email')?.innerText;
        const cached = (activeEmail && activeEmail !== '---') ? localStorage.getItem(`unibox_cert_${activeEmail}`) : null;
        const resolvedData = certData || cached;
        const hasCert = certName && certName !== 'None' && certName !== 'None attached';

        currentAthleteCert = { name: certName, data: resolvedData };

        if (resolvedData && activeEmail && activeEmail !== '---') {
            localStorage.setItem(`unibox_cert_${activeEmail}`, resolvedData);
        }

        const btn = document.getElementById('dash-view-cert-btn');
        if (btn) {
            if (hasCert || resolvedData) {
                btn.classList.remove('hidden');
                btn.classList.add('inline-flex');
            } else {
                btn.classList.add('hidden');
                btn.classList.remove('inline-flex');
            }
        }
    }

    function openCertViewerModal(name, data) {
        const activeEmail = sessionStorage.getItem('unibox_active_email') || document.getElementById('dash-player-email')?.innerText;
        const cached = (activeEmail && activeEmail !== '---') ? localStorage.getItem(`unibox_cert_${activeEmail}`) : null;
        const resolvedData = data || currentAthleteCert.data || cached;
        const resolvedName = name || currentAthleteCert.name || 'Sports Certificate';

        const modal = document.getElementById('cert-viewer-modal');
        const title = document.getElementById('cert-viewer-title');
        const sub = document.getElementById('cert-viewer-sub');
        const img = document.getElementById('cert-viewer-img');
        const pdf = document.getElementById('cert-viewer-pdf');
        const empty = document.getElementById('cert-viewer-empty');
        const dlLink = document.getElementById('cert-download-link');

        if (!modal) {
            console.error('Certificate modal element not found!');
            return;
        }

        title.textContent = resolvedName;
        sub.textContent = resolvedData ? 'Verified Athlete Document Proof' : 'No preview available';

        img.classList.add('hidden');
        pdf.classList.add('hidden');
        empty.classList.add('hidden');

        if (resolvedData) {
            dlLink.href = resolvedData;
            dlLink.classList.remove('hidden');

            if (resolvedData.startsWith('data:application/pdf') || resolvedData.endsWith('.pdf')) {
                pdf.src = resolvedData;
                pdf.classList.remove('hidden');
            } else {
                img.src = resolvedData;
                img.classList.remove('hidden');
            }
        } else {
            dlLink.classList.add('hidden');
            empty.classList.remove('hidden');
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.classList.add('overflow-hidden');
    }

    function closeCertViewerModal() {
        const modal = document.getElementById('cert-viewer-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        const pdf = document.getElementById('cert-viewer-pdf');
        if (pdf) pdf.src = '';
        document.body.classList.remove('overflow-hidden');
    }

    window.openCertViewerModal = openCertViewerModal;
    window.closeCertViewerModal = closeCertViewerModal;

    document.getElementById('dash-view-cert-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        openCertViewerModal(currentAthleteCert.name, currentAthleteCert.data);
    });

    // Realtime Auction Reflection on Player Dashboard
    if (window.UniBoxDb && window.UniBoxDb.subscribeToAuctionUpdates) {
        window.UniBoxDb.subscribeToAuctionUpdates(async (event) => {
            const activeEmail = sessionStorage.getItem('unibox_active_email');
            const savedSessionRaw = localStorage.getItem('unibox_student_session');
            let email = activeEmail;
            if (!email && savedSessionRaw) {
                try {
                    const session = JSON.parse(savedSessionRaw);
                    email = session?.email;
                } catch (e) {}
            }

            if (email && window.UniBoxDb) {
                const { data: freshPlayer } = await window.UniBoxDb.getPlayerByEmail(email);
                if (freshPlayer) {
                    applyProfileToUI(freshPlayer);
                }
            }
        });
    }

    // ==============================================================================
    // HERO STATS STRIP & LIVE ATHLETE COUNT SYNCHRONIZATION (1000ms Interval)
    // ==============================================================================
    let athleteSyncInterval = null;
    let athleteSyncInProgress = false;
    let lastKnownAthleteCount = null;
    let heroRealtimeUnsub = null;

    function formatAthleteCount(count) {
        if (typeof count !== 'number' || isNaN(count)) return '--';
        return count < 10 ? `0${count}` : String(count);
    }

    function updateHeroAthleteDisplay(newCount) {
        const athleteEl = document.getElementById('hero-stat-athletes');
        if (!athleteEl) return;

        const formatted = formatAthleteCount(newCount);
        if (athleteEl.textContent !== formatted) {
            athleteEl.textContent = formatted;
            // Subtle micro-transition without layout jump or card bounce
            athleteEl.classList.add('text-amber-300');
            setTimeout(() => {
                athleteEl.classList.remove('text-amber-300');
            }, 300);
        }
    }

    async function syncAthleteCount() {
        if (athleteSyncInProgress) return;
        athleteSyncInProgress = true;

        try {
            if (window.UniBoxDb && typeof window.UniBoxDb.getAthletesCount === 'function') {
                const { count, error } = await window.UniBoxDb.getAthletesCount();
                if (!error && count !== null && count !== undefined) {
                    lastKnownAthleteCount = count;
                    updateHeroAthleteDisplay(count);
                } else if (lastKnownAthleteCount !== null) {
                    // Preserve last known valid count if Supabase has a temporary network hiccup
                    updateHeroAthleteDisplay(lastKnownAthleteCount);
                }
            } else if (window.UniBoxDb && typeof window.UniBoxDb.getAllPlayers === 'function') {
                const { data, error } = await window.UniBoxDb.getAllPlayers();
                if (!error && Array.isArray(data)) {
                    lastKnownAthleteCount = data.length;
                    updateHeroAthleteDisplay(data.length);
                } else if (lastKnownAthleteCount !== null) {
                    updateHeroAthleteDisplay(lastKnownAthleteCount);
                }
            }
        } catch (err) {
            console.warn('[ATHLETE COUNT SYNC] Sync error:', err);
            if (lastKnownAthleteCount !== null) {
                updateHeroAthleteDisplay(lastKnownAthleteCount);
            }
        } finally {
            athleteSyncInProgress = false;
        }
    }

    function startAthleteCountSync() {
        if (athleteSyncInterval) {
            clearInterval(athleteSyncInterval);
            athleteSyncInterval = null;
        }
        // 1000ms background interval
        athleteSyncInterval = setInterval(syncAthleteCount, 1000);
    }

    function stopAthleteCountSync() {
        if (athleteSyncInterval) {
            clearInterval(athleteSyncInterval);
            athleteSyncInterval = null;
        }
    }

    // 1. Initial Immediate Sync
    syncAthleteCount();

    // 2. Start 1-second background synchronization
    startAthleteCountSync();

    // 3. Primary: Realtime event listener for instant updates
    if (window.UniBoxDb && typeof window.UniBoxDb.subscribeToAuctionUpdates === 'function') {
        heroRealtimeUnsub = window.UniBoxDb.subscribeToAuctionUpdates((event) => {
            if (!event || 
                event.type === 'PLAYER_REGISTERED' || 
                event.type === 'PLAYER_DELETED' || 
                event.type === 'ALL_PLAYERS_DELETED' || 
                event.type === 'SUPABASE_REALTIME') {
                syncAthleteCount();
            }
        });
    }

    // 4. Page Visibility Management: Reduce background work when tab hidden, immediate sync on tab focus
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAthleteCountSync();
        } else {
            syncAthleteCount();
            startAthleteCountSync();
        }
    });

    // 5. Cleanup before unload
    window.addEventListener('beforeunload', () => {
        stopAthleteCountSync();
        if (typeof heroRealtimeUnsub === 'function') {
            heroRealtimeUnsub();
            heroRealtimeUnsub = null;
        }
    });

    // Make sync accessible globally for testing & external triggers
    window.syncAthleteCount = syncAthleteCount;
    window.startAthleteCountSync = startAthleteCountSync;
    window.stopAthleteCountSync = stopAthleteCountSync;

    // Run auto-restore
    restoreStudentSession();
});


