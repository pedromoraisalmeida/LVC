const fs = require('fs');

const envContent = `
window.ENV = {
  SUPABASE_URL: '${process.env.VITE_SUPABASE_URL || ''}',
  SUPABASE_KEY: '${process.env.VITE_SUPABASE_KEY || ''}'
};
`;

fs.writeFileSync('env.js', envContent);
console.log('✅ env.js generated');