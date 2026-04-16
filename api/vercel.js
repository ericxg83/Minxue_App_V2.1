// Vercel Serverless Function - JavaScript wrapper for TypeScript Express app
// @ts-check

/**
 * @typedef {import('@vercel/node').VercelResponse} VercelResponse
 * @typedef {import('@vercel/node').VercelRequest} VercelRequest
 */

// Import the Express app
import app from './index.ts';

// Export default handler for Vercel
/**
 * @param {VercelRequest} req
 * @param {VercelResponse} res
 */
export default function handler(req, res) {
  app(req, res);
}