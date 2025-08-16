const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Static file hosting (untuk index.html)
app.use(express.static('public'));
app.use(express.json());

// Dapatkan API key dari Railway
const AFTERSHIP_API_KEY = process.env.AFTERSHIP_API_KEY;

if (!AFTERSHIP_API_KEY) {
  console.warn('⚠️ AFTERSHIP_API_KEY tidak ditemui! Sila tambah di Railway Variables');
}

/**
 * Route: /api/track/:trackingNumber
 * Contoh: /api/track/123456789012
 */
app.get('/api/track/:trackingNumber', async (req, res) => {
  const trackingNumber = req.params.trackingNumber.trim();

  // Validasi input
  if (!trackingNumber) {
    return res.status(400).json({ error: 'Tracking number diperlukan' });
  }

  if (!AFTERSHIP_API_KEY) {
    console.error('❌ AFTERSHIP_API_KEY tidak disediakan');
    return res.status(500).json({ error: 'Internal Error: API key tidak disediakan' });
  }

  try {
    console.log(`🔍 Mencari tracking: ${trackingNumber}`);

    const response = await axios.get('https://api.aftership.com/v4/trackings', {
      params: {
        tracking_number: trackingNumber
      },
      headers: {
        'aftership-api-key': AFTERSHIP_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 saat
    });

    const { data, meta } = response.data;

    // Semak jika ada meta error
    if (meta.code !== 200) {
      console.error('❌ AfterShip meta error:', meta.message);
      return res.status(meta.code).json({ error: meta.message });
    }

    // Semak jika ada tracking result
    if (!data?.trackings || data.trackings.length === 0) {
      return res.json({ error: 'Tracking number tidak ditemui di AfterShip' });
    }

    const tracking = data.trackings[0];

    // Formatkan respons untuk frontend
    const result = {
      tracking_number: tracking.tracking_number,
      courier: tracking.slug, // contoh: 'dhl', 'fedex'
      origin: tracking.origin?.country_iso3 || 'N/A',
      destination: tracking.destination?.country_iso3 || 'N/A',
      status: formatStatus(tracking.tag),
      events: formatCheckpoints(tracking.checkpoints),
    };

    console.log(`✅ Berjaya dapat data untuk ${trackingNumber}`);
    return res.json(result);
  } catch (err) {
    // Log error untuk debug
    console.error('🔴 Error lengkap:', {
      message: err.message,
      code: err.response?.status,
      data: err.response?.data?.meta,
      url: err.config?.url
    });

    // Handle error khusus
    if (err.response?.status === 401) {
      return res.status(500).json({ 
        error: '🔐 API key AfterShip tidak sah. Sila semak di Railway.' 
      });
    }

    if (err.response?.status === 404) {
      return res.json({ 
        error: '📦 Tracking number tidak ditemui di sistem courier.' 
      });
    }

    if (err.code === 'ECONNABORTED') {
      return res.status(500).json({ 
        error: '⏱️ Permintaan tamat masa (timeout) kepada AfterShip.' 
      });
    }

    return res.status(500).json({
      error: '📡 Gagal mendapatkan data dari AfterShip',
      details: err.response?.data?.meta?.message || err.message
    });
  }
});

/**
 * Format status supaya lebih mesra pengguna
 */
function formatStatus(tag) {
  const statusMap = {
    'Pending': 'Menunggu',
    'InfoReceived': 'Maklumat Diterima',
    'InTransit': 'Dalam Penghantaran',
    'OutForDelivery': 'Sedang Dihantar',
    'Delivered': 'Berjaya Dihantar',
    'Exception': 'Isu Penghantaran',
    'Expired': 'Tammat Tempoh'
  };
  return statusMap[tag] || tag;
}

/**
 * Format checkpoints (sejarah tracking)
 */
function formatCheckpoints(checkpoints = []) {
  return checkpoints
    .sort((a, b) => new Date(b.checkpoint_time) - new Date(a.checkpoint_time)) // Terkini dulu
    .map(cp => ({
      status: formatStatus(cp.tag),
      location: [
        cp.location || '',
        cp.country_iso3 || ''
      ].filter(Boolean).join(', '),
      datetime: new Date(cp.checkpoint_time).toLocaleString('ms-MY', {
        timeZone: 'Asia/Kuala_Lumpur'
      })
    }));
}

// Jalankan server
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
  console.log(`🔗 Gunakan: /api/track/123456789`);
  if (!AFTERSHIP_API_KEY) {
    console.log('❗ AFTERSHIP_API_KEY belum diset — sila tambah di Railway');
  }
});

module.exports = app;