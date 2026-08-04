// Wait until DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".form");
  const password = document.getElementById("password");
  const confirmPassword = document.getElementById("confirm-password");
  const toggle = document.getElementById("toggle");
  const ctoggle = document.getElementById("ctoggle");
  const otpModal = document.getElementById("otp-modal");
  const otpForm = document.getElementById("otp-form");
  const otpInput = document.getElementById("otp-input");
  const otpError = document.getElementById("otp-error");
  const otpEmailDisplay = document.getElementById("otp-email-display");
  const resendLink = document.getElementById("resend-link");
  let currentEmail = "";

  // Toggle password visibility
  function togglePassword(input, icon) {
    if (input.type === "password") {
      input.type = "text";
      icon.classList.remove("fa-eye");
      icon.classList.add("fa-eye-slash");
    } else {
      input.type = "password";
      icon.classList.remove("fa-eye-slash");
      icon.classList.add("fa-eye");
    }
  }

  toggle.addEventListener("click", () => togglePassword(password, toggle));
  ctoggle.addEventListener("click", () => togglePassword(confirmPassword, ctoggle));

  // Form validation
 form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName = document.getElementById("First name").value.trim();
    const secondName = document.getElementById("Second name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone-number").value.trim();
    const dob = document.getElementById("date-of-birth").value;

    if (firstName === "" || secondName === "" || email === "" || phone === "" || dob === "") {
      alert("Please fill out all fields.");
      return;
    }
    if (password.value !== confirmPassword.value) {
      alert("Passwords do not match.");
      return;
    }
    if (password.value.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    const res = await fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.success === true) {
      currentEmail = email;
      otpEmailDisplay.textContent = email;
      otpModal.style.display = "flex"; // show modal instead of redirecting
    } else {
      alert(result.message || "Sign-up unsuccessful");
    }
  });

  // OTP verify submit
  otpForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    otpError.textContent = "";

    const otp = otpInput.value.trim();

    const res = await fetch("/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentEmail, otp })
    });

    const result = await res.json();

    if (result.success) {
      window.location.href = "/signin.html"; // only redirect after verified
    } else {
      otpError.textContent = result.message || "Incorrect code, try again";
    }
  });

  // Resend OTP
  resendLink.addEventListener("click", async (e) => {
    e.preventDefault();
    otpError.textContent = "";

    const res = await fetch("/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentEmail })
    });

    const result = await res.json();
    otpError.textContent = result.message;
  });
});
