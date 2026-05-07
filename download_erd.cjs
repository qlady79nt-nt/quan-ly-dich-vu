const fs = require('fs');
const http = require('https');

const code = `erDiagram
    shops ||--o{ profiles : "co"
    shops ||--o{ customers : "phuc vu"
    shops ||--o{ services : "cung cap"
    shops ||--o{ packages : "cung cap"
    shops ||--o{ invoices : "tao"
    
    plans ||--o{ shops : "gan cho"
    
    profiles ||--o{ invoices : "nguoi tao"
    profiles ||--o{ invoice_items : "ky thuat vien"
    profiles ||--o{ package_sales : "nguoi ban goi"
    profiles ||--o{ service_sessions : "ky thuat vien"
    
    customers ||--o{ invoices : "thanh toan"
    
    services ||--o{ packages : "chua"
    services ||--o{ service_sessions : "su dung"
    
    invoices ||--|{ invoice_items : "gom"
    invoices ||--o| package_sales : "lien ket"
    
    packages ||--o{ customer_packages : "ban thanh"
    
    customer_packages ||--o{ package_sales : "chi tiet ban"
    customer_packages ||--o{ service_sessions : "phieu tru buoi"`;

const state = { code, mermaid: { theme: 'default' } };
const jsonString = JSON.stringify(state);
const buffer = Buffer.from(jsonString, 'utf8');
const base64 = buffer.toString('base64');
const url = 'https://mermaid.ink/img/' + base64;

const file = fs.createWriteStream('C:\\A\\QuanLyDichVu\\erd_diagram.png');
http.get(url, function(response) {
  response.pipe(file);
  file.on('finish', function() {
    file.close();
    console.log('Image downloaded as erd_diagram.png');
    
    // Copy to artifacts dir
    const artifactDir = 'C:\\Users\\pc\\.gemini\\antigravity\\brain\\d9e4389e-7aec-41f0-9765-2dd48deea9a6';
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }
    fs.copyFileSync('C:\\A\\QuanLyDichVu\\erd_diagram.png', artifactDir + '\\erd_diagram.png');
    console.log('Copied to artifacts');
  });
}).on('error', function(err) {
  fs.unlink('C:\\A\\QuanLyDichVu\\erd_diagram.png', () => {});
  console.error('Error downloading image: ' + err.message);
});
