// Proxy para o handler principal com path '/confirm'
const handler = require('../reset-password');
module.exports = (req, res) => {
  req.url = (req.url || '') + '/confirm';
  return handler(req, res);
};
