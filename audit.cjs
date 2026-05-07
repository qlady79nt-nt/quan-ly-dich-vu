const fs = require('fs');
const path = require('path');

const schemaDir = process.cwd();
const sqlFiles = ['supabase_new_schema.sql', 'schema_patch.sql'];

let schema = '';
for (const file of sqlFiles) {
  if (fs.existsSync(file)) {
    schema += fs.readFileSync(file, 'utf8') + '\n';
  }
}

// Extract table definitions
const tables = {};
const createTableRegex = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\);/g;
let match;
while ((match = createTableRegex.exec(schema)) !== null) {
  const tableName = match[1];
  const columnsRaw = match[2];
  const columns = columnsRaw.split(/,\n|\r\n/).map(c => c.trim()).filter(c => c && !c.startsWith('--') && !c.startsWith('PRIMARY KEY') && !c.startsWith('UNIQUE'));
  tables[tableName] = columns.map(c => c.split(' ')[0]);
}

// Extract ALTER TABLE ADD COLUMN
const alterTableRegex = /ALTER TABLE (\w+) ADD COLUMN (?:IF NOT EXISTS )?(\w+)/g;
while ((match = alterTableRegex.exec(schema)) !== null) {
  const tableName = match[1];
  const colName = match[2];
  if (tables[tableName]) {
    tables[tableName].push(colName);
  }
}

console.log('--- SCHEMA DUMP ---');
for (const [table, cols] of Object.entries(tables)) {
  console.log(`Table: ${table}`);
  console.log(`  Columns: ${cols.join(', ')}`);
}

// Now search src/ for supabase inserts
const srcDir = path.join(process.cwd(), 'src', 'pages');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.tsx'));

console.log('\n--- INSERT USAGE DUMP ---');
for (const file of files) {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  // Look for .from('table').insert([{ col: val, ... }])
  const insertRegex = /\.from\(['"](\w+)['"]\)\.insert\(\[\{([\s\S]*?)\}\]/g;
  let insertMatch;
  while ((insertMatch = insertRegex.exec(content)) !== null) {
    const tableName = insertMatch[1];
    const payloadRaw = insertMatch[2];
    
    // Naive extraction of keys
    const keys = [];
    const lines = payloadRaw.split('\n');
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length > 1) {
        const key = parts[0].replace(/['"\s{]/g, '').trim();
        if (key && !key.startsWith('//') && !key.startsWith('...')) {
            // Check if there's a comma inside the value which breaks naive split
            // good enough for quick audit
            if (key.match(/^[a-zA-Z_0-9]+$/)) {
                keys.push(key);
            }
        }
      }
    }
    
    console.log(`${file} -> INSERT ${tableName}: ${keys.join(', ')}`);
    
    if (tables[tableName]) {
       const missing = keys.filter(k => !tables[tableName].includes(k));
       if (missing.length > 0) {
          console.log(`  WARNING: Missing columns in schema: ${missing.join(', ')}`);
       }
    } else {
       console.log(`  WARNING: Table ${tableName} not found in schema files.`);
    }
  }
}
