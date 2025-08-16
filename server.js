// server.js
const express = require('express');
const axios = require('axios');

const app = express();

// Tentukan port dari environment atau guna 3000
const PORT = process.env.PORT || 3000;

// Izinkan CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Static file (frontend)
app.use(express.static('public'));

// Route untuk test
app.get('/', (req, res) => {
  res.send('Backend berjalan! Gunakan /api/track/123');
});

// Route tracking
app.get('/api/track/:tracking', async (req, res) => {
  const trackingNumber = req.params.tracking;

  // Ganti dengan API key anda
  const TRACKMAGE_API_KEY = process.env.TRACKMAGE_API_KEY;

  if (!TRACKMAGE_API_KEY) {
    return res.status(500).json({ error: 'API key tidak disediakan' });
  }

  try {
    const response = await axios.get('https://api.trackmage.com/v1/tracking', {
      params: { trackingNumber },
      headers: {
        'x-api-key': TRACKMAGE_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;

    if (data.success && data.data?.length > 0) {
      const t = data.data[0];
      return res.json({
        tracking_number: t.trackingNumber,
        courier: t.courierName || t.courier,
        status: t.status,
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
    console.error('Error:', err.response?.data || err.message);
    return res.status(500).json({
      error: 'Gagal dapat data',
      details: err.response?.data?.message || err.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
});