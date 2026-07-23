const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('route.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('d:/portal-sekolah/be-portal-sekolah/src/app/api');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('"Access-Control-Allow-Origin": "*"')) {
    content = content.replace(/"Access-Control-Allow-Origin": "\*"/g, '"Access-Control-Allow-Origin": process.env.APP_URL || "http://localhost:3000"');
    content = content.replace(/"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID"/g, '"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID",\n      "Access-Control-Allow-Credentials": "true"');
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});
