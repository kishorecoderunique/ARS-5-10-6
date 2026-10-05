function notFound(req, res) {
  res.status(404).json({ message: 'Route not found' });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.statusCode || err.status || (err.name === 'ValidationError' ? 400 : 500);
  if (status >= 500) console.error(err.message);
  return res.status(status).json({
    message: status >= 500 ? 'An unexpected server error occurred.' : err.message
  });
}

module.exports = { notFound, errorHandler };
