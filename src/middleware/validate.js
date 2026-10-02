const { HttpError } = require('../utils/http');

// validate({ params, query, body }) with zod schemas; replaces req.* with parsed values
module.exports = (schemas) => (req, res, next) => {
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(new HttpError(400, 'Validation failed', details));
    }
    req[key] = result.data;
  }
  next();
};
