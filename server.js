// server.js
// Versi paling ringkas untuk elak crash

const express = require('express');
const app = express();

// Tentukan port
const PORT = process.env.PORT || 3000;

// Izinkan CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Route utama
app.get('/', (req, res) => {
  res.send(`
    <h2>📦 Courier Tracking Backend</h2>
    <p>✅ Backend berjalan!</p>
    <p>Gunakan: <code>/api/track/123</code></p>
  `);
});

// Route tracking (dummy dulu)
app.get('/api/track/:awb', (req, res) => {
  const awb = req.params.awb;
  res.json({
    tracking_number: awb,
    courier: "Pos Malaysia (Dummy)",
    status: "In Transit",
    events: [
      { status: "Info Received", location: "Kuala Lumpur", datetime: "2025-04-05 10:00" },
      { status: "In Transit", location: "Selangor", datetime: "2025-04-05 14:30" }
    ]
  });
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
});