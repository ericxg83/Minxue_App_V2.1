import app from './api/index';

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`\n🚀 API Server running on port ${PORT}`);
  console.log(`📡 Endpoint: http://localhost:${PORT}/api`);
  console.log(`=====================================\n`);
});