import jwt from 'jsonwebtoken'

export const requireAuth = (req, res, next) => {
  const token = req.cookies.token

  if (!token) {
    console.log('❌ No token found in cookies')
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log('✅ Decoded token:', decoded) // See user info here
    req.user = decoded
    next()
  } catch (err) {
    console.log('❌ Invalid token:', err.message)
    return res.status(401).json({ message: 'Invalid token' })
  }
}
