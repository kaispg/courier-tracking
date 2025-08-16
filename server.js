// server.js
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');

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

// Simpan mapping courier dari CSV
let courierMap = new Map();

// Baca couriers.csv untuk auto-detect
function loadCouriers() {
  return new Promise((resolve, reject) => {
    fs.createReadStream('couriers.csv')
      .pipe(csv())
      .on('data', (row) => {
        const slug = row['Courier Slug'];
        const name = row['Courier Name'];
        if (slug && name) {
          courierMap.set(slug, name);
        }
      })
      .on('end', () => {
        console.log(`✅ ${courierMap.size} courier dimuatkan`);
        resolve();
      })
      .on('error', (err) => reject(err));
  });
}

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

  // Default: cuba hantar tanpa slug
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

    // Format respons
    const result = {
      tracking_number: data.tracking_number,
      courier_slug: data.slug,
      courier_name: courierMap.get(data.slug) || data.slug,
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
        datetime: new Date(cp.checkpoint_time).toLocaleString(),
        timezone: cp.time_zone || 'N/A'
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
    <p>Backend berjalan! Gunakan: <code>/api/track/123</code></p>
    <p>Support: DHL, FedEx, UPS, Pos Malaysia, dll</p>
  `);
});

// Load couriers sebelum start
loadCouriers()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server berjalan di port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Gagal muat couriers:', err.message);
    app.listen(PORT, () => {
      console.log(`⚠️ Server berjalan, tapi courier tidak dimuat`);
    });
  });