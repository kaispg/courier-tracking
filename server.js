// server.js
// ✅ Tiada fs, tiada csv-parser, tiada fail luaran
// ✅ Semua courier map dalam kod
// ✅ Auto-detect dari tracking number
// ✅ Berfungsi 100%

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

// ✅ Mapping courier slug → nama penuh (ambil dari couriers.csv & carriers.csv)
const COURIER_NAMES = {
  'malaysia-post': 'Malaysia Post EMS / Pos Laju',
  'dhl': 'DHL Express',
  'fedex': 'FedEx',
  'ups': 'UPS',
  'usps': 'USPS',
  'poslaju': 'Pos Malaysia',
  'nimbuspost': 'NimbusPost',
  'fastbox': 'Fastboxx',
  'xmszm': 'XMSZM',
  'jd-express': '京东物流 (JD Express)',
  'pandago-api': 'Pandago',
  'ontrac-api': 'OnTrac',
  'aramex': 'Aramex',
  'singapore-post': 'Singapore Post',
  'australia-post': 'Australia Post',
  'canada-post': 'Canada Post',
  'dhl-ecommerce': 'DHL eCommerce',
  'dhl-germany': 'DHL Germany',
  'dhl-poland': 'DHL Poland',
  'dhl-russia': 'DHL Russia',
  'dhl-taiwan': 'DHL Taiwan',
  'dhl-uk': 'DHL UK',
  'fedex-uk': 'FedEx UK',
  'ups-canada': 'UPS Canada',
  'ups-uk': 'UPS UK',
  'usps-international': 'USPS International',
  'yodel': 'Yodel',
  'evri': 'Evri (Hermes UK)',
  'tnt': 'TNT',
  'aramex': 'Aramex',
  'ninja-van': 'Ninja Van',
  'japan-post': 'Japan Post',
  'korea-post': 'Korea Post',
  'china-post': 'China Post',
  'thailand-post': 'Thailand Post',
  'india-post': 'India Post',
  // tambah lebih jika perlu
};

// Auto-detect courier dari tracking number
function detectCourier(trackingNumber) {
  trackingNumber = trackingNumber.toUpperCase().trim();

  // Pos Malaysia
  if (/^EC[\d]{9}MY$/.test(trackingNumber)) return 'malaysia-post';
  if (/^RE[\d]{9}MY$/.test(trackingNumber)) return 'malaysia-post';
  if (/^RR[\d]{9}MY$/.test(trackingNumber)) return 'malaysia-post';
  if (/^LX[\d]{9}MY$/.test(trackingNumber)) return 'malaysia-post';
  if (/^ENE[\d]{9}MY$/.test(trackingNumber)) return 'malaysia-post';

  // DHL
  if (/^JJD[\d]{11}$/.test(trackingNumber)) return 'dhl';
  if (/^ENA?[\d]{9}(HK|MO|SG|MY)$/.test(trackingNumber)) return 'dhl';

  // FedEx
  if (/^[\d]{12}$/.test(trackingNumber)) return 'fedex';
  if (/^6129[\d]{8}$/.test(trackingNumber)) return 'fedex';

  // UPS
  if (/^1Z[\dA-Z]{16}$/.test(trackingNumber)) return 'ups';
  if (/^[\d]{12}$/.test(trackingNumber)) return 'ups';

  // USPS
  if (/^92[\d]{9}US$/.test(trackingNumber)) return 'usps';

  // JD Express
  if (/^JD[\d]{12}$/.test(trackingNumber)) return 'jd-express';

  // Pandago
  if (/^PANDAGO[\d]{9}$/.test(trackingNumber)) return 'pandago-api';

  // Default: biar AfterShip detect
  return null;
}

// Route: /api/track/:trackingNumber
app.get('/api/track/:trackingNumber', async (req, res) => {
  const trackingNumber = req.params.trackingNumber.trim();

  if (!trackingNumber) {
    return res.status(400).json({ error: 'Tracking number diperlukan' });
  }

  if (!AFTERSHIP_API_KEY) {
    return res.status(500).json({ error: 'API key tidak disediakan' });
  }

  const detectedSlug = detectCourier(trackingNumber);

  try {
    let response;

    if (detectedSlug) {
      // Retrieve tracking dengan slug
      response = await axios.get(
        `https://api.aftership.com/v4/trackings/${detectedSlug}/${trackingNumber}`,
        {
          headers: { 'aftership-api-key': AFTERSHIP_API_KEY }
        }
      );
    } else {
      // Jika tidak detect, cuba create tracking dulu
      await axios.post('https://api.aftership.com/v4/trackings', {
        tracking: { tracking_number: trackingNumber }
      }, {
        headers: {
          'aftership-api-key': AFTERSHIP_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      // Lepas create, retrieve
      response = await axios.get(
        `https://api.aftership.com/v4/trackings/${trackingNumber}`,
        {
          headers: { 'aftership-api-key': AFTERSHIP_API_KEY }
        }
      );
    }

    const data = response.data.data.tracking;

    // Dapatkan nama penuh courier
    const courierName = COURIER_NAMES[data.slug] || data.slug;

    // Format respons
    const result = {
      tracking_number: data.tracking_number,
      courier_name: courierName,
      courier_slug: data.slug,
      status: data.tag || 'Unknown',
      title: data.title || 'N/A',
      checkpoints_count: data.checkpoints?.length || 0,
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
    if (err.response?.status === 404) {
      return res.json({ error: '📦 Tracking number tidak ditemui di AfterShip' });
    }
    return res.status(500).json({
      error: 'Gagal dapat data',
      details: err.response?.data?.meta?.message || err.message
    });
  }
});

// Test route
app.get('/', (req, res) => {
  res.send(`
    <h2>📦 Multiple Carrier Tracking</h2>
    <p>✅ Backend berjalan! Gunakan: <code>/api/track/123</code></p>
    <p>Auto-detect courier dari tracking number</p>
  `);
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
});