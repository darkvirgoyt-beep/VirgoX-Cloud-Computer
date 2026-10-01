(() => {
  const params = new URLSearchParams(location.search);
  const code = (params.get("code") || "").trim().toUpperCase();
  const codeEl = document.getElementById("code");
  const form = document.getElementById("login");
  const msg = document.getElementById("message");

  if (!code || !/^[A-Z0-9]{8,16}$/.test(code)) {
    codeEl.textContent = "INVALID CODE";
    form.style.display = "none";
    msg.textContent = "This authorization link is invalid or incomplete.";
    return;
  }

  codeEl.textContent = code;

  const cfg = window.VIRGOX_FIREBASE_CONFIG || {};
  if (!cfg.apiKey || cfg.apiKey.startsWith("YOUR_")) {
    msg.textContent = "Firebase web configuration is not deployed yet.";
    return;
  }

  firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const endpoint = window.VIRGOX_AUTH_FUNCTION;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    msg.textContent = "Signing in…";
    try {
      const cred = await auth.signInWithEmailAndPassword(
        document.getElementById("email").value.trim(),
        document.getElementById("password").value
      );
      const token = await cred.user.getIdToken(true);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({action: "authorize", code})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authorization failed");
      msg.textContent = "✓ Authorized. You can return to the terminal.";
      form.remove();
      await auth.signOut();
    } catch (error) {
      msg.textContent = error && error.message ? error.message : "Authorization failed.";
    }
  });
})();
