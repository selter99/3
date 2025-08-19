#!/usr/bin/env node
/**
 * CLI: node scripts/add-post.mjs "https://example.com/product"
 * Optional flags:
 *   --keyword="từ khóa"
 *   --lang=vi|en
 *   --audience="..."
 *   --tone="..."
 *   --tags="a,b,c"
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
if (!args[0]) {
  console.error('Usage: node scripts/add-post.mjs "<URL>" [--keyword="..."] [--lang=vi] [--audience="..."] [--tone="..."] [--tags="a,b"]');
  process.exit(1);
}

const link = args[0];
const findFlag = (name, def='') => {
  const reg = new RegExp(`^--${name}=(.*)$`);
  const found = args.find(a => reg.test(a));
  return found ? found.match(reg)[1] : def;
};

const payload = {
  link,
  primaryKeyword: findFlag('keyword', ''),
  language: findFlag('lang', 'vi'),
  audience: findFlag('audience', 'người dùng phổ thông'),
  tone: findFlag('tone', 'thân thiện'),
  tags: findFlag('tags', '').split(',').map(s => s.trim()).filter(Boolean)
};

async function main() {
  const res = await fetch('http://localhost:4321/api/generate-post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!data.success) {
    console.error('Lỗi:', data.error);
    process.exit(1);
  }
  console.log('✅ Tạo thành công:', data);
}
main().catch(e => {
  console.error(e);
  process.exit(1);
});