require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');

// One connection pool per process. Database queries belong in controllers.
const db = new PrismaClient();
module.exports = db;
