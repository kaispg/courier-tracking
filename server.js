const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// Guna API key AfterShip
const AFTERSHIP_API_KEY = process.env.AFTERSHIP_API_KEY;

app.get('/api/track/:awb', async (req, res) => {
  const awb = req.params.awb.replace(/-/g, ''); // buang dash
  const carrier = getCarrierSlug(awb.substring(0, 3));

  if (!AFTERSHIP_API_KEY) {
    return res.status(500).json({ error: 'AfterShip API key tidak disediakan' });
  }

  try {
    const response = await axios.get(`https://api.aftership.com/v4/trackings`, {
      params: {
        tracking_number: awb,
        slug: carrier
      },
      headers: {
        'aftership-api-key': AFTERSHIP_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const data = response.data.data.trackings;

    if (data.length > 0) {
      const t = data[0];
      res.json({
        awb: t.tracking_number,
        origin: t.origin_country_iso3 || 'N/A',
        destination: t.destination_country_iso3 || 'N/A',
        status: t.tag || 'Unknown',
        courier: t.slug,
        events: t.checkpoints?.map(cp => ({
          status: cp.tag,
          location: `${cp.location || ''} ${cp.country_iso3 || ''}`.trim(),
          datetime: new Date(cp.checkpoint_time).toLocaleString()
        })).reverse() || []
      });
    } else {
      res.json({ error: 'AWB tidak ditemui di AfterShip' });
    }
  } catch (err) {
    console.error('AfterShip error:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Gagal panggil AfterShip API',
      details: err.response?.data?.meta?.message || err.message
    });
  }
});

// Peta AWB prefix kepada courier slug
function getCarrierSlug(prefix) {
  const carriers = {
    '065': 'american-airlines',       // AA
    '165': 'saudi-airlines',          // SV
    '176': 'emirates',                // EK
    '157': 'qatar-airways',           // QR
    '020': 'lufthansa',               // LH
    '115': 'united-airlines',         // UA
    '001': 'american-airlines'        // AA (alternatif)
  };
  return carriers[prefix] || null;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;