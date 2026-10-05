/**
 * ARS - Disaster Rescue & SOS Management System
 * Single Login Page Controller (/assets/js/auth.js)
 * Rescue Radar Centered Card Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  const roleRescuerBtn = document.getElementById('role-rescuer-btn');
  const roleAdminBtn = document.getElementById('role-admin-btn');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const alertContainer = document.getElementById('auth-alert');
  const signupLinkContainer = document.getElementById('signup-link-container');
  const passwordInput = document.getElementById('login-password');
  const toggleEyeBtn = document.getElementById('toggle-password-eye');

  // In-card step views
  const loginStep = document.getElementById('login-step');
  const signupStep = document.getElementById('signup-step');
  const forgotStep1 = document.getElementById('forgot-step-1');
  const forgotStep2 = document.getElementById('forgot-step-2');
  const forgotStep3 = document.getElementById('forgot-step-3');

  // Links & Navigation
  const showSignupBtn = document.getElementById('show-signup-link');
  const showLoginFromSignup = document.getElementById('show-login-from-signup');
  const showForgotBtn = document.getElementById('show-forgot-btn');
  const cancelForgotBtn = document.getElementById('cancel-forgot-btn');

  // Progress Dots
  const dots = document.querySelectorAll('.progress-dot');
  const progressDots = document.querySelector('.step-progress-dots');

  let selectedRole = window.ARS_State.getLastSelectedRole() || 'rescuer';
  let loginAttemptStarted = false;
  let healthCheckTimer = null;

  // Check URL query params if role forced
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('role') === 'admin') {
    selectedRole = 'admin';
  }

  // --- Initialize Selected Role UI ---
  updateRoleUI(selectedRole);
  monitorApiHealth();

  if (roleRescuerBtn) {
    roleRescuerBtn.addEventListener('click', () => {
      selectedRole = 'rescuer';
      window.ARS_State.setLastSelectedRole('rescuer');
      updateRoleUI('rescuer');
      clearAlert();
    });
  }

  if (roleAdminBtn) {
    roleAdminBtn.addEventListener('click', () => {
      selectedRole = 'admin';
      window.ARS_State.setLastSelectedRole('admin');
      updateRoleUI('admin');
      clearAlert();
    });
  }

  function updateRoleUI(role) {
    if (roleRescuerBtn && roleAdminBtn) {
      if (role === 'rescuer') {
        roleRescuerBtn.classList.add('active');
        roleAdminBtn.classList.remove('active');
        if (signupLinkContainer) signupLinkContainer.style.display = 'block';
      } else {
        roleAdminBtn.classList.add('active');
        roleRescuerBtn.classList.remove('active');
        if (signupLinkContainer) signupLinkContainer.style.display = 'none';
      }
    }
  }

  // --- Show / Hide Password Eye Toggle ---
  if (toggleEyeBtn && passwordInput) {
    toggleEyeBtn.addEventListener('click', () => {
      const currentType = passwordInput.getAttribute('type');
      if (currentType === 'password') {
        passwordInput.setAttribute('type', 'text');
        toggleEyeBtn.innerHTML = `
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>
          </svg>
        `;
      } else {
        passwordInput.setAttribute('type', 'password');
        toggleEyeBtn.innerHTML = `
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        `;
      }
    });
  }

  // --- In-Card Step Switcher ---
  function showStep(stepName) {
    clearAlert();
    [loginStep, signupStep, forgotStep1, forgotStep2, forgotStep3].forEach(step => {
      if (step) step.style.display = 'none';
    });
    if (progressDots) {
      progressDots.style.display = stepName === 'login' ? 'none' : 'flex';
    }

    let activeDotIdx = 0;
    if (stepName === 'login') {
      if (loginStep) loginStep.style.display = 'block';
      activeDotIdx = 0;
    } else if (stepName === 'signup') {
      if (signupStep) signupStep.style.display = 'block';
      activeDotIdx = 1;
    } else if (stepName === 'forgot1') {
      if (forgotStep1) forgotStep1.style.display = 'block';
      activeDotIdx = 1;
    } else if (stepName === 'forgot2') {
      if (forgotStep2) forgotStep2.style.display = 'block';
      activeDotIdx = 2;
    } else if (stepName === 'forgot3') {
      if (forgotStep3) forgotStep3.style.display = 'block';
      activeDotIdx = 3;
    }

    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === activeDotIdx);
    });
  }

  if (showSignupBtn) showSignupBtn.addEventListener('click', (e) => { e.preventDefault(); showStep('signup'); });
  if (showLoginFromSignup) showLoginFromSignup.addEventListener('click', (e) => { e.preventDefault(); showStep('login'); });
  if (showForgotBtn) showForgotBtn.addEventListener('click', (e) => { e.preventDefault(); showStep('forgot1'); });
  if (cancelForgotBtn) cancelForgotBtn.addEventListener('click', (e) => { e.preventDefault(); showStep('login'); });

  // --- Login Form Handler ---
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginAttemptStarted = true;
      const phone = document.getElementById('login-phone').value.trim();
      const password = document.getElementById('login-password').value.trim();
      const submitBtn = document.getElementById('login-submit-btn');

      if (!phone || !password) {
        showAlert('Please enter both mobile number and password.', 'error');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `⚡ AUTHENTICATING SIGNALS...`;
      }

      try {
        const res = await window.ARS_State.login(phone, password, selectedRole);
        if (res.success) {
          showAlert(`Welcome Commander ${res.user.name}. Redirecting...`, 'success');
          window.location.href = res.user.role === 'admin' ? '/admin/index.html' : '/rescuer/index.html';
        }
      } catch (error) {
        showAlert(error.message, 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'LOGIN TO ARS';
        }
      }
    });
  }

  // --- Sign Up Submission (In-Card) ---
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value.trim();
      const phone = document.getElementById('signup-phone').value.trim();
      const password = document.getElementById('signup-password').value.trim();
      const confirmPassword = document.getElementById('signup-confirm-password').value.trim();

      if (!name || !phone || !password) {
        showAlert('Please fill in all required fields.', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showAlert('Passwords do not match.', 'error');
        return;
      }

      try {
        await window.ARS_State.registerRescuer(name, phone, password);
        signupForm.reset();
        showAlert('Registration submitted! Waiting for admin approval.', 'success');
        setTimeout(() => {
          showStep('login');
          showAlert('Account registered. Please wait for admin approval before logging in.', 'success');
        }, 1800);
      } catch (error) {
        showAlert(error.message, 'error');
      }
    });
  }

  // --- 3-Step Forgot Password In-Card Wizard ---
  let verifiedOtp = '';
  let otpTimerInterval = null;

  const btnStep1Next = document.getElementById('btn-forgot-step1');
  const btnStep2Next = document.getElementById('btn-forgot-step2');
  const btnStep3Save = document.getElementById('btn-forgot-step3');
  const resendOtpBtn = document.getElementById('resend-otp-btn');

  if (btnStep1Next) {
    btnStep1Next.addEventListener('click', async () => {
      const phone = document.getElementById('forgot-phone').value.trim();
      if (!phone || phone.length < 8) {
        showAlert('Please enter a valid mobile number.', 'error');
        return;
      }
      clearAlert();

      try {
        await window.ARS_API.request('/auth/forgot/request-otp', { method: 'POST', body: { phone } });
        showStep('forgot2');
        startOtpTimer();
        otpFields[0]?.focus();
        showAlert('If an account exists, a verification code has been sent.', 'success');
      } catch (error) {
        showAlert(error.message, 'error');
      }
    });
  }

  function startOtpTimer() {
    let timeLeft = 30;
    const timerElem = document.getElementById('otp-countdown');
    if (resendOtpBtn) resendOtpBtn.disabled = true;

    if (otpTimerInterval) clearInterval(otpTimerInterval);
    otpTimerInterval = setInterval(() => {
      timeLeft--;
      if (timerElem) timerElem.textContent = `${timeLeft}s`;

      if (timeLeft <= 0) {
        clearInterval(otpTimerInterval);
        if (resendOtpBtn) resendOtpBtn.disabled = false;
        if (timerElem) timerElem.textContent = 'Resend available';
      }
    }, 1000);
  }

  if (resendOtpBtn) {
    resendOtpBtn.addEventListener('click', async () => {
      try {
        await window.ARS_API.request('/auth/forgot/request-otp', {
          method: 'POST',
          body: { phone: document.getElementById('forgot-phone').value.trim() }
        });
        showAlert('If an account exists, a new verification code has been sent.', 'success');
        startOtpTimer();
      } catch (error) {
        showAlert(error.message, 'error');
      }
    });
  }

  if (btnStep2Next) {
    btnStep2Next.addEventListener('click', async () => {
      const otpInputs = document.querySelectorAll('.otp-field');
      let enteredOtp = '';
      otpInputs.forEach(input => enteredOtp += input.value.trim());

      if (!/^\d{6}$/.test(enteredOtp)) {
        showAlert('Enter the 6-digit verification code.', 'error');
        return;
      }
      try {
        await window.ARS_API.request('/auth/forgot/verify-otp', {
          method: 'POST',
          body: { phone: document.getElementById('forgot-phone').value.trim(), otp: enteredOtp }
        });
        verifiedOtp = enteredOtp;
        clearAlert();
        showStep('forgot3');
      } catch (error) {
        showAlert(error.message, 'error');
      }
    });
  }

  if (btnStep3Save) {
    btnStep3Save.addEventListener('click', async () => {
      const newPass = document.getElementById('new-password').value.trim();
      const confirmPass = document.getElementById('confirm-new-password').value.trim();

      if (!newPass) {
        showAlert('Please enter a new password.', 'error');
        return;
      }
      if (newPass !== confirmPass) {
        showAlert('Passwords do not match.', 'error');
        return;
      }

      const phone = document.getElementById('forgot-phone').value.trim();
      try {
        await window.ARS_API.request('/auth/forgot/reset-password', {
          method: 'POST',
          body: { phone, otp: verifiedOtp, password: newPass }
        });
      } catch (error) {
        showAlert(error.message, 'error');
        return;
      }

      showAlert('Password updated successfully! Returning to login...', 'success');
      setTimeout(() => {
        showStep('login');
      }, 1500);
    });
  }

  // --- Auto-Advance OTP Fields ---
  const otpFields = document.querySelectorAll('.otp-field');
  otpFields.forEach((field, idx) => {
    field.addEventListener('input', (e) => {
      const digits = e.target.value.replace(/\D/g, '');
      if (digits.length > 1) {
        const start = digits.length === otpFields.length ? 0 : idx;
        for (let fieldIndex = start; fieldIndex < otpFields.length; fieldIndex++) {
          otpFields[fieldIndex].value = '';
        }
        digits.slice(0, otpFields.length - start).split('').forEach((digit, offset) => {
          otpFields[start + offset].value = digit;
        });
        otpFields[Math.min(start + digits.length, otpFields.length - 1)].focus();
      } else {
        e.target.value = digits;
      }
      if (digits.length === 1 && idx < otpFields.length - 1) {
        otpFields[idx + 1].focus();
      }
    });
    field.addEventListener('paste', (event) => {
      const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, otpFields.length);
      if (!digits) return;
      event.preventDefault();
      otpFields.forEach(input => { input.value = ''; });
      digits.split('').forEach((digit, offset) => {
        otpFields[offset].value = digit;
      });
      otpFields[Math.min(digits.length, otpFields.length - 1)].focus();
    });
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        otpFields[idx - 1].focus();
      }
    });
  });

  // Alert Utility
  function monitorApiHealth() {
    const check = async () => {
      const health = await window.ARS_API.checkHealth();
      if (health.ok) {
        if (healthCheckTimer) clearInterval(healthCheckTimer);
        if (alertContainer?.dataset.kind === 'api-health') clearAlert();
        return;
      }
      if (!loginAttemptStarted && (!alertContainer.textContent || alertContainer.dataset.kind === 'api-health')) {
        showAlert(health.message || 'The backend is running but its database is not connected.', 'error');
        alertContainer.dataset.kind = 'api-health';
      }
    };
    check();
    healthCheckTimer = setInterval(check, 3000);
  }

  function showAlert(msg, type) {
    if (!alertContainer) return;
    alertContainer.textContent = msg;
    alertContainer.className = `alert-message active alert-${type}`;
    alertContainer.dataset.kind = 'form';
  }

  function clearAlert() {
    if (!alertContainer) return;
    alertContainer.className = 'alert-message';
    alertContainer.textContent = '';
    delete alertContainer.dataset.kind;
  }
});
