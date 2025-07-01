document.addEventListener("DOMContentLoaded", () => {
  // Customer Register
  const custRegisterForm = document.querySelector("#customer-register form");
  custRegisterForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const FullName = custRegisterForm.querySelector('input[type="text"]').value;
    const Email = custRegisterForm.querySelector('input[type="email"]').value;
    const Password = custRegisterForm.querySelector('input[type="password"]').value;

    try {
      const res = await fetch("http://localhost:3000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ FullName, Email, Password, Role: "user" }),
      });
      const data = await res.json();
      alert(data.message || "Kayıt başarılı");
    } catch (err) {
      alert("Bir hata oluştu");
      console.error(err);
    }
  });

  // Owner Register
  const ownerRegisterForm = document.querySelector("#owner-register form");
  ownerRegisterForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const Name = ownerRegisterForm.querySelector('input[type="text"]').value;
    const Email = ownerRegisterForm.querySelector('input[type="email"]').value;
    const Password = ownerRegisterForm.querySelector('input[type="password"]').value;

    try {
      const res = await fetch("http://localhost:3000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ FullName: Name, Email, Password, Role: "owner" }),
      });
      const data = await res.json();
      alert(data.message || "Kayıt başarılı");
    } catch (err) {
      alert("Bir hata oluştu");
      console.error(err);
    }
  });

// Customer Login
const customerLoginForm = document.querySelector("#customer-login form");
customerLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = customerLoginForm.querySelector('input[type="email"]').value;
  const password = customerLoginForm.querySelector('input[type="password"]').value;

  try {
    const res = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    console.log('Login response:', data);
    if (data.success && data.role === "user") {
      // localStorage set edilirken id farklı isimde olabilir, kontrol et
      const userId = data.id || data.userId;
      const userName = data.name || data.userName;
      if (!userId) {
        alert("User ID bulunamadı!");
        return;
      }
      localStorage.setItem("userId", userId);
      localStorage.setItem("userName", userName || "");
      localStorage.setItem("userRole", data.role);
      window.location.href = "zmc-user-screen.html";
    } else {
      alert(data.message || "Login failed");
    }
  } catch (err) {
    alert("Sunucuya bağlanılamıyor");
    console.error(err);
  }
});

// Owner Login
const ownerLoginForm = document.querySelector("#owner-login form");
ownerLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = ownerLoginForm.querySelector('input[type="email"]').value;
  const password = ownerLoginForm.querySelector('input[type="password"]').value;

  try {
    const res = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    console.log('Login response:', data);
    if (data.success && data.role === "owner") {
      // ownerId veya id kontrolü
      const ownerId = data.id || data.ownerId;
      const ownerName = data.name || data.ownerName;
      if (!ownerId) {
        alert("Owner ID bulunamadı!");
        return;
      }
      localStorage.setItem("userId", ownerId);
      localStorage.setItem("userName", ownerName || "");
      localStorage.setItem("userRole", data.role);
      window.location.href = "zmc-owner-restorant.html";
    } else {
      alert(data.message || "Login failed");
    }
  } catch (err) {
    alert("Sunucuya bağlanılamıyor");
    console.error(err);
  }
});

});
