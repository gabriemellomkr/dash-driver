// Proxy: repassa ao handler principal sinalizando que é a rota /confirm
const handler = require('./reset-password');
module.exports = (req, res) => {
  req.url = (req.url || '') + '/confirm';
  return handler(req, res);
};
