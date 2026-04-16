/**
 * Vercel Serverless Function Handler
 * Direct export of the Express app for Vercel
 */

import app from './index';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

export default app;