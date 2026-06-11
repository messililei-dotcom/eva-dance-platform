(function () {
  const TOKEN_KEY = "saishi_admin_token";
  const USER_KEY = "saishi_admin_user";
  const STATIC_ADMIN = {
    username: "lilei",
    password: "yilei520",
    user: { username: "lilei", name: "李雷", role: "超级管理员" },
  };

  const overlay = document.querySelector("#login-overlay");
  const form = document.querySelector("#login-form");
  const usernameInput = document.querySelector("#login-username");
  const passwordInput = document.querySelector("#login-password");
  const errorBox = document.querySelector("#login-error");
  const submitButton = document.querySelector("#login-submit");

  function hasToken() {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  }

  function setAppVisibility(isLoggedIn) {
    document.body.classList.toggle("auth-required", !isLoggedIn);
    document.querySelector(".sidebar")?.toggleAttribute("hidden", !isLoggedIn);
    document.querySelector(".shell")?.toggleAttribute("hidden", !isLoggedIn);
    overlay?.classList.toggle("hidden", isLoggedIn);
  }

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  function isStaticPreview() {
    return location.protocol === "file:" || ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  }

  function loginStaticAdmin(username, password) {
    if (username !== STATIC_ADMIN.username || password !== STATIC_ADMIN.password) {
      throw new Error("预览账号或密码错误");
    }
    localStorage.setItem(TOKEN_KEY, "preview-admin-token");
    localStorage.setItem(USER_KEY, JSON.stringify(STATIC_ADMIN.user));
    setAppVisibility(true);
    window.location.reload();
  }

  async function handleLogin(event) {
    event?.preventDefault();
    showError("");

    const username = usernameInput?.value.trim();
    const password = passwordInput?.value;
    if (!username || !password) {
      showError("请输入用户名和密码");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "登录中...";

    try {
      if (isStaticPreview()) {
        loginStaticAdmin(username, password);
        return;
      }

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.token) {
        throw new Error(result.message || "用户名或密码错误");
      }

      localStorage.setItem(TOKEN_KEY, result.token);
      if (result.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      }

      setAppVisibility(true);
      window.location.reload();
    } catch (error) {
      showError(error.message || "登录失败，请稍后重试");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "登录";
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.reload();
  }

  window.handleLogin = handleLogin;
  window.logout = logout;

  form?.addEventListener("submit", handleLogin);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !hasToken() && document.activeElement?.closest("#login-overlay")) {
      handleLogin(event);
    }
  });

  setAppVisibility(hasToken());
  if (!hasToken()) {
    usernameInput?.focus();
  }
})();
