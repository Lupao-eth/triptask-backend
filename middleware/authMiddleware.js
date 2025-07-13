import jwt from 'jsonwebtoken';

// ✅ Cookie-based middleware (for legacy use or if needed)
export const requireAuth = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    console.log('❌ No token found in cookies');
    return res.status(401).json({ message: 'Unauthorized: No token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Decoded token from cookie:', decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.log('❌ Invalid or expired cookie token:', err.message);

    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'None',
      secure: true,
    });

    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ✅ NEW: Authorization Header Middleware (for token-based auth)
export const requireBearerAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No Bearer token provided');
    return res.status(401).json({ message: 'Unauthorized: No Bearer token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Decoded token from Bearer:', decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.log('❌ Invalid or expired Bearer token:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ✅ Used for Socket.IO handshake auth
export const verifySocketToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET); // { id, email, role }
  } catch (err) {
    console.error('❌ Socket token error:', err.message);
    return null;
  }
};
