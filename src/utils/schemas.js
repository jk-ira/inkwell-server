const { z } = require('zod');

const idParam = z.object({ id: z.string().uuid('Invalid id') });

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
};

const password = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/\d/, 'Password must contain a number');

module.exports = { z, idParam, pagination, password };
