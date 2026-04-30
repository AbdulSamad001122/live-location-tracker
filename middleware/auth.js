import dotenv from 'dotenv';
dotenv.config();

const OIDC_USERINFO_ENDPOINT = process.env.OIDC_USERINFO_ENDPOINT;

const tokenCache = new Map();

export async function verifyToken(token) {
  if (!token) return null;

  if (tokenCache.has(token)) {
    const cached = tokenCache.get(token);
    if (Date.now() - cached.timestamp < 3600000) {
      return cached.user;
    }
    tokenCache.delete(token);
  }

  try {
    const response = await fetch(OIDC_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const user = await response.json();
    tokenCache.set(token, { user, timestamp: Date.now() });
    
    return user;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  const user = await verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = user;
  next();
}
