// backend/middleware/checkServiceOnline.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware to block requests if service is offline
export const checkServiceOnline = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('service_status')
      .select('is_online')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('❌ Error checking service status:', error);
      return res.status(500).json({ error: 'Unable to verify service status.' });
    }

    if (!data?.is_online) {
      return res.status(403).json({ error: 'Service is currently offline.' });
    }

    next();
  } catch (err) {
    console.error('❌ Unexpected error in service check:', err);
    return res.status(500).json({ error: 'Unexpected error checking service status.' });
  }
};
