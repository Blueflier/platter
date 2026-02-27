require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Dev A routes ---
const searchRoutes = require('./routes/search');
app.use('/api', searchRoutes);

// --- Dev B routes ---
const generateRoutes = require('./routes/generate');
const businessRoutes = require('./routes/businesses');
app.use('/api', generateRoutes);
app.use('/api', businessRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Platter running on http://localhost:${PORT}`));
