document.addEventListener("DOMContentLoaded", () => {
  const password = document.getElementById("password");
  const toggle = document.getElementById("toggle");
  const form = document.querySelector(".signin-form");
  const logout = document.querySelector(".logout");
  const errorMsg = document.getElementById("errorMsg");
  
  function togglePassword(input, icon) {
    if (input.type === "password") {
      input.type = "text";
      icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
      input.type = "password";
      icon.classList.replace("fa-eye-slash", "fa-eye");
    }
  }

  toggle.addEventListener("click", () => togglePassword(password, toggle));

  

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    const res = await fetch("/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    console.log(result);

    if (result.success) {

      // ✅ Store email from form
      localStorage.setItem("userEmail", data.email);

      // ✅ Store role from backend
      localStorage.setItem("userRole", result.role);

      if (result.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "userdashboard.html";
      }

    } else {
      errorMsg.textContent = result.message || "Login failed";
    }
  });
});
