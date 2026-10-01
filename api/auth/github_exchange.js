module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code } = req.body || {};
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "GitHub OAuth is not configured on Vercel" });
  }
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing OAuth code" });
  }

  const redirectUri = "https://virgoxcloud.vercel.app/";

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "VirgoX-Cloud-Computer"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    });

    const token = await tokenResponse.json();
    if (!tokenResponse.ok || token.error || !token.access_token) {
      return res.status(401).json({
        error: token.error_description || token.error || "GitHub token exchange failed"
      });
    }

    const ghHeaders = {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "VirgoX-Cloud-Computer"
    };

    const [profileResponse, emailsResponse] = await Promise.all([
      fetch("https://api.github.com/user", { headers: ghHeaders }),
      fetch("https://api.github.com/user/emails", { headers: ghHeaders })
    ]);

    const profile = await profileResponse.json();
    const emails = emailsResponse.ok ? await emailsResponse.json() : [];
    if (!profileResponse.ok || !profile.login) {
      return res.status(401).json({ error: "Could not verify GitHub account" });
    }

    const primary = Array.isArray(emails)
      ? emails.find(e => e.primary && e.verified) || emails.find(e => e.verified)
      : null;

    return res.status(200).json({
      status: "ok",
      github_username: profile.login,
      name: profile.name || profile.login,
      avatar: profile.avatar_url || "",
      email: primary?.email || profile.email || ""
    });
  } catch (error) {
    return res.status(502).json({ error: "GitHub OAuth service unavailable" });
  }
};
