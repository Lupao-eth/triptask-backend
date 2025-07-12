import jwt from 'jsonwebtoken';

// Middleware for REST API routes (uses cookie)
export const requireAuth = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    console.log('❌ No token found in cookies');
    return res.status(401).json({ message: 'Unauthorized: No token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Decoded token:', decoded); // { id, email, role }

    req.user = decoded; // Attach user info to request
    next();
  } catch (err) {
    console.log('❌ Invalid or expired token:', err.message);

    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'None',
      secure: true,
    });

    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ✅ Optional helper to verify token directly (for Socket.IO)
export const verifySocketToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET); // returns { id, email, role }
  } catch (err) {
    console.error('❌ Socket token error:', err.message);
    return null;
  }
};
