import { cors  } from '_shared.js';

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  
  res.status(200).json({
    ok: true,
    service: 'virgox-auth',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    storage: 'file'
  });
};
