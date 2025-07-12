// backend/middleware/checkServiceOnline.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Middleware to block requests if service is offline
export const checkServiceOnline = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('service_status')
      .select('is_online')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('❌ Error checking service status from Supabase:', error.message);
      return res.status(500).json({ error: 'Unable to verify service status from database.' });
    }

    if (!data?.is_online) {
      console.warn('⚠️ Request blocked: Service is currently offline');
      return res.status(403).json({ error: 'Service is currently offline. Please try again later.' });
    }

    next();
  } catch (err) {
    console.error('❌ Unexpected error in checkServiceOnline middleware:', err.message);
    return res.status(500).json({ error: 'Unexpected error checking service status.' });
  }
};
