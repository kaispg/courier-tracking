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

app.use(express.static('public'));
app.use(express.json());

const TRACKMAGE_API_KEY = process.env.TRACKMAGE_API_KEY;

if (!TRACKMAGE_API_KEY) {
  console.warn('⚠️ TRACKMAGE_API_KEY tidak ditemui!');
}

app.get('/api/track/:tracking', async (req, res) => {
  const trackingNumber = req.params.tracking.trim();

  if (!trackingNumber) {
    return res.status(400).json({ error: 'Tracking number diperlukan' });
  }

  if (!TRACKMAGE_API_KEY) {
    return res.status(500).json({ error: 'API key tidak disediakan' });
  }

  try {
    // ✅ URL BETUL: /v1/tracking
    const response = await axios.get('https://api.trackmage.com/v1/tracking', {
      params: { trackingNumber },
      headers: {
        'x-api-key': TRACKMAGE_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const data = response.data;

    // ✅ Semak struktur respons
    if (data.success && data.data?.length > 0) {
      const t = data.data[0];
      return res.json({
        tracking_number: t.trackingNumber,
        courier: t.courierName || t.courier || 'Unknown',
        origin: t.origin?.country || 'N/A',
        destination: t.destination?.country || 'N/A',
        status: t.status || 'Unknown',
        events: (t.checkpoints || []).map(cp => ({
          status: cp.tag,
          location: [cp.location, cp.country].filter(Boolean).join(', '),
          datetime: new Date(cp.time).toLocaleString()
        })).reverse()
      });
    } else {
      return res.json({ error: 'Tracking number tidak ditemui' });
    }
  } catch (err) {
    console.error('TrackMage Error:', {
      status: err.response?.status,
       err.response?.data,
      message: err.message
    });

    if (err.response?.status === 401) {
      return res.status(500).json({ error: '🔐 API key tidak sah' });
    }

    if (err.response?.status === 404) {
      return res.json({ error: '📦 Tracking number tidak ditemui di sistem courier' });
    }

    return res.status(500).json({
      error: '📡 Gagal panggil TrackMage',
      details: err.response?.data?.message || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
});