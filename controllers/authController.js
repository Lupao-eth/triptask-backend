// src/controllers/authController.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import supabase from '../config/supabaseClient.js';

const COOKIE_DOMAIN = 'triptask-backend.up.railway.app'; // ✅ set to your Railway backend domain

// 🔐 LOGIN
export const login = async (req, res) => {
  const { email, password, rememberMe } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Wrong password' });
    }

    // ✅ Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: rememberMe ? '7d' : '1h' }
    );

    // ✅ Set cookie with domain for iOS Safari & cross-origin
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      domain: COOKIE_DOMAIN,
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).json({ message: 'Login failed' });
  }
};

// 👤 GET CURRENT USER
export const getMe = async (req, res) => {
  const token = req.cookies.token;
  console.log('🔍 Incoming token cookie:', token);

  if (!token) {
    return res.status(401).json({ message: 'Not logged in' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Decoded JWT:', decoded);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('❌ Token decode error:', err.message);
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'None',
      secure: true,
      domain: COOKIE_DOMAIN,
    });
    res.status(401).json({ message: 'Invalid token' });
  }
};

// 🔓 LOGOUT
export const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'None',
    secure: true,
    domain: COOKIE_DOMAIN,
  });
  res.json({ message: 'Logged out successfully' });
};

// 📝 REGISTER
export const register = async (req, res) => {
  const { name, email, password, role = 'customer' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ name, email, password: hashedPassword, role }])
      .select('id, name, email, role')
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser,
    });
  } catch (err) {
    console.error('❌ Register error:', err.message);
    res.status(500).json({ message: 'Registration failed' });
  }
};
