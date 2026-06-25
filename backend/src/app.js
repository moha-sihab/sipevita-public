const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const pengajuanRoutes = require('./routes/pengajuan.routes');
const reviewerRoutes = require('./routes/reviewer.routes');
const blockchainRoutes = require('./routes/blockchain.routes');
const publicRoutes = require('./routes/public.routes');
const logRoutes = require('./routes/log.routes');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pengajuan', pengajuanRoutes);
app.use('/api/reviewer', reviewerRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/logs', logRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
