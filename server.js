const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Static file hosting
app.use(express.static('public'));
app.use(express.json());

// Dapatkan API key dari Railway
const AFTERSHIP_API_KEY = process.env.AFTERSHIP_API_KEY;

if (!AFTERSHIP_API_KEY) {
  console.warn('⚠️ AFTERSHIP_API_KEY tidak ditemui! Sila tambah di Railway Variables');
}

/**
 * Route: /api/track/:trackingNumber
 * Contoh: /api/track/ENE083992448MY
 */
app.get('/api/track/:trackingNumber', async (req, res) => {
  const trackingNumber = req.params.trackingNumber.trim().toUpperCase();

  // Validasi input
  if (!trackingNumber || trackingNumber.length < 4 || trackingNumber.length > 100) {
    return res.status(400).json({ error: 'Tracking number tidak sah (4-100 aksara)' });
  }

  if (!AFTERSHIP_API_KEY) {
    console.error('❌ AFTERSHIP_API_KEY tidak disediakan');
    return res.status(500).json({ error: 'Internal Error: API key tidak disediakan' });
  }

  try {
    console.log(`🔍 Mencari tracking: ${trackingNumber}`);

    // ✅ Create Tracking (AfterShip API)
    const response = await axios.post('https://api.aftership.com/v4/trackings', {
      tracking: {
        tracking_number: trackingNumber,
        slug: 'malaysia-post' // ✅ Pos Malaysia
      }
    }, {
      headers: {
        'aftership-api-key': AFTERSHIP_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const data = response.data.data.tracking;

    // Format respons untuk frontend
    const result = {
      tracking_number: data.tracking_number,
      courier: 'Pos Malaysia',
      origin: data.origin?.country_iso3 || 'N/A',
      destination: data.destination?.country_iso3 || 'N/A',
      status: data.tag || 'Unknown',
      events: (data.checkpoints || []).map(cp => ({
        status: cp.tag,
        location: [
          cp.location || '',
          cp.city || '',
          cp.state || '',
          cp.country_iso3 || ''
        ].filter(Boolean).join(', '),
        datetime: new Date(cp.checkpoint_time).toLocaleString()
      })).reverse()
    };

    console.log(`✅ Berjaya dapat data untuk ${trackingNumber}`);
    return res.json(result);
  } catch (err) {
    console.error('🔴 Error lengkap:', {
      message: err.message,
      status: err.response?.status,
       err.response?.data,
      url: err.config?.url
    });

    // Handle error khusus
    if (err.response?.status === 401) {
      return res.status(500).json({ error: '🔐 API key tidak sah' });
    }

    if (err.response?.status === 400) {
      return res.json({ error: '🚫 Tracking number tidak sah atau tidak dijumpai' });
    }

    if (err.code === 'ECONNABORTED') {
      return res.status(500).json({ error: '⏱️ Permintaan tamat masa' });
    }

    return res.status(500).json({
      error: 'Gagal panggil AfterShip API',
      details: err.response?.data?.meta?.message || err.message
    });
  }
});

// Test route
app.get('/', (req, res) => {
  res.send('Backend berjalan! Gunakan /api/track/123');
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
});