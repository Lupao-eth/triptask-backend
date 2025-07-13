// backend/middleware/checkServiceOnline.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const checkServiceOnline = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('service_status')
      .select('is_online')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('❌ Failed to fetch service status:', error.message);
      return res.status(500).json({ error: 'Could not verify service status' });
    }

    if (!data?.is_online) {
      console.warn('⚠️ Blocked request: Service is offline');
      return res.status(403).json({ error: 'Service is currently offline' });
    }

    next();
  } catch (err) {
    console.error('❌ checkServiceOnline error:', err.message);
    return res.status(500).json({ error: 'Service check failed' });
  }
};
