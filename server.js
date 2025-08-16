// server.js
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: Izinkan semua domain (untuk frontend)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cache-Control', 'no-store'); // 🔥 Elak 304
  next();
});

// Gunakan folder 'public' untuk frontend
app.use(express.static('public'));

// Route: /api/track/XXXXX
app.get('/api/track/:trackingNumber', async (req, res) => {
  const trackingNumber = req.params.trackingNumber.trim().toUpperCase();

  // Validasi tracking number
  if (!trackingNumber || trackingNumber.length < 4 || trackingNumber.length > 100) {
    return res.status(400).json({ error: 'Tracking number tidak sah (4-100 aksara)' });
  }

  // Dapatkan API key dari Railway
  const AFTERSHIP_API_KEY = process.env.AFTERSHIP_API_KEY;

  if (!AFTERSHIP_API_KEY) {
    console.error('❌ AFTERSHIP_API_KEY tidak disediakan di environment');
    return res.status(500).json({ error: 'Internal Error: API key tidak disediakan' });
  }

  try {
    // ✅ Retrieve tracking: GET /v4/trackings/malaysia-post/XXXXX
    const response = await axios.get(
      `https://api.aftership.com/v4/trackings/malaysia-post/${trackingNumber}`,
      {
        headers: {
          'aftership-api-key': AFTERSHIP_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    const data = response.data.data.tracking;

    // Format data untuk frontend
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

    return res.json(result);
  } catch (err) {
    console.error('🔴 AfterShip API Error:', {
      status: err.response?.status,
       err.response?.data,
      message: err.message
    });

    // Handle error khusus
    if (err.response?.status === 401) {
      return res.status(500).json({ error: '🔐 API key tidak sah. Semak di Railway.' });
    }

    if (err.response?.status === 404) {
      return res.json({ error: '📦 Tracking number tidak ditemui di AfterShip.' });
    }

    if (err.code === 'ECONNABORTED') {
      return res.status(500).json({ error: '⏱️ Permintaan tamat masa (timeout).' });
    }

    return res.status(500).json({
      error: 'Gagal dapat data dari AfterShip',
      details: err.response?.data?.meta?.message || err.message
    });
  }
});

// Route: Test backend hidup
app.get('/', (req, res) => {
  res.send(`
    <h2>📦 Courier Tracking Backend</h2>
    <p>Backend berjalan!</p>
    <p>Gunakan: <code>/api/track/ENE083992448MY</code></p>
    <p><small>Pos Malaysia tracking via AfterShip API</small></p>
  `);
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
});