// Vercel Serverless Function entrypoint
const { createServer } = require('http');
// tsx compiles ts on the fly, but for Vercel we need to point to the built file
// Vercel handles the TS compilation if configured, but an easier way is to just export the ts file directly if using @vercel/node builders.
// Let's use the ts file directly.
import app from '../src/server';

export default app;
