const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cache-Control', 'no-store');
  next();
});

app.use(express.static('public'));
app.use(express.json());

const AFTERSHIP_API_KEY = process.env.AFTERSHIP_API_KEY;

if (!AFTERSHIP_API_KEY) {
  console.warn('⚠️ AFTERSHIP_API_KEY tidak ditemui!');
}

// Helper: Buat tracking jika belum wujud
async function ensureTrackingCreated(trackingNumber) {
  try {
    // Cuba retrieve dulu
    await axios.get(`https://api.aftership.com/v4/trackings/malaysia-post/${trackingNumber}`, {
      headers: { 'aftership-api-key': AFTERSHIP_API_KEY }
    });
    // Jika berjaya, dah ada
  } catch (err) {
    if (err.response?.status === 404) {
      // Jika tak wujud, create
      await axios.post('https://api.aftership.com/v4/trackings', {
        tracking: {
          tracking_number: trackingNumber,
          slug: 'malaysia-post'
        }
      }, {
        headers: {
          'aftership-api-key': AFTERSHIP_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      console.log(`✅ Tracking ${trackingNumber} dicipta`);
    }
  }
}

app.get('/api/track/:trackingNumber', async (req, res) => {
  const trackingNumber = req.params.trackingNumber.trim().toUpperCase();

  if (!trackingNumber) {
    return res.status(400).json({ error: 'Tracking number diperlukan' });
  }

  if (!AFTERSHIP_API_KEY) {
    return res.status(500).json({ error: 'API key tidak disediakan' });
  }

  try {
    // Pastikan tracking dah wujud di AfterShip
    await ensureTrackingCreated(trackingNumber);

    // Retrieve data
    const response = await axios.get(
      `https://api.aftership.com/v4/trackings/malaysia-post/${trackingNumber}`,
      {
        headers: {
          'aftership-api-key': AFTERSHIP_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data.data.tracking;

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
    console.error('AfterShip Error:', err.response?.data || err.message);
    if (err.response?.status === 401) {
      return res.status(500).json({ error: '🔐 API key tidak sah' });
    }
    return res.status(500).json({
      error: 'Gagal dapat data',
      details: err.response?.data?.meta?.message || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
});