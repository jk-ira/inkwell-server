const { HttpError } = require('../utils/http');

const notFound = (req, res, next) => next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, ...(err.details && { details: err.details }) } });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { message: 'Malformed JSON body' } });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: { message: 'Request body too large' } });
  if (err.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ error: { message: 'Already exists' } });
  if ((err.parent?.code || err.code) === '22P02') return res.status(400).json({ error: { message: 'Invalid identifier' } });
  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error' } });
};

module.exports = { notFound, errorHandler };
