const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const AFTERSHIP_API_KEY = process.env.AFTERSHIP_API_KEY;

// Detect courier dari tracking number
function detectCourier(trackingNumber) {
  trackingNumber = trackingNumber.toUpperCase().trim();

  // Pos Malaysia
  if (/^EC[\d]{9}MY$/.test(trackingNumber)) return 'pos-malaysia';
  if (/^RE[\d]{9}MY$/.test(trackingNumber)) return 'pos-malaysia';
  if (/^RR[\d]{9}MY$/.test(trackingNumber)) return 'pos-malaysia';
  if (/^LX[\d]{9}MY$/.test(trackingNumber)) return 'pos-malaysia';
  if (/^ENE[\d]{9}MY$/.test(trackingNumber)) return 'pos-malaysia'; // ✅ ENE083992448MY

  // DHL
  if (/^JJD[\d]{11}$/.test(trackingNumber)) return 'dhl';
  if (/^ENA?[\d]{9}(HK|MO|SG|MY)$/.test(trackingNumber)) return 'dhl';

  // UPS
  if (/^1Z[\dA-Z]{16}$/.test(trackingNumber)) return 'ups';
  if (/^[\d]{12}$/.test(trackingNumber)) return 'ups';

  // FedEx
  if (/^[\d]{12}$/.test(trackingNumber)) return 'fedex'; // boleh clash, guna last

  // USPS
  if (/^92[\d]{9}US$/.test(trackingNumber)) return 'usps';

  return null;
}

app.get('/api/track/:tracking', async (req, res) => {
  const trackingNumber = req.params.tracking.trim();

  if (!trackingNumber) {
    return res.status(400).json({ error: 'Tracking number diperlukan' });
  }

  if (!AFTERSHIP_API_KEY) {
    return res.status(500).json({ error: 'API key tidak disediakan' });
  }

  const detectedCourier = detectCourier(trackingNumber);

  try {
    const response = await axios.get('https://api.aftership.com/v4/trackings', {
      params: {
        tracking_number: trackingNumber,
        ...(detectedCourier && { slug: detectedCourier })
      },
      headers: {
        'aftership-api-key': AFTERSHIP_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const data = response.data;

    if (data.meta.code === 200 && data.data.trackings.length > 0) {
      const t = data.data.trackings[0];
      return res.json({
        tracking_number: t.tracking_number,
        courier: t.slug,
        origin: t.origin?.country_iso3 || 'N/A',
        destination: t.destination?.country_iso3 || 'N/A',
        status: t.tag,
        events: (t.checkpoints || []).map(cp => ({
          status: cp.tag,
          location: [cp.location, cp.country_iso3].filter(Boolean).join(', '),
          datetime: new Date(cp.checkpoint_time).toLocaleString()
        })).reverse()
      });
    } else {
      return res.json({ error: 'Tracking number tidak ditemui' });
    }
  } catch (err) {
    console.error('API Error:', err.response?.data || err.message);
    if (err.response?.status === 401) {
      return res.status(500).json({ error: '🔐 API key tidak sah' });
    }
    return res.status(500).json({
      error: 'Gagal panggil AfterShip',
      details: err.response?.data?.meta?.message || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
});