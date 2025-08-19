/**
 * cron/auto-post.mjs
 * NodeJS cron job to create/publish posts twice weekly using OpenAI + crawl
 * - Monday 09:00: publish 1 post
 * - Thursday 09:00: publish 1 post
 * Also exposes a function to create drafts or publish immediately (reusable by Admin).
 */
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import { OpenAI } from 'openai';

const __root = process.cwd();
const seedsPath = path.join(__root, 'cron', 'seeds.json');
const statePath = path.join(__root, 'cron', 'state.json');

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}
function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function slugify(input) {
  return (input || 'bai-viet')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

async function downloadImage(url, destPath) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Astro-Cron)' } });
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(destPath, buf);
}

function ogSvgOverlay(title) {
  const safeTitle = String(title||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
  return Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs>
      <linearGradient id="fade" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="rgba(0,0,0,0.75)"/>
        <stop offset="1" stop-color="rgba(0,0,0,0.25)"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#fade)"/>
    <g fill="#ffffff" font-family="Inter, Arial, Helvetica, sans-serif">
      <text x="60" y="540" font-size="54" font-weight="700">${safeTitle}</text>
    </g>
  </svg>
  `.trim());
}

function detectCategory(title, url, keyword='') {
  const hay = `${title||''} ${url||''} ${keyword||''}`.toLowerCase();
  if (/(ai|artificial intelligence|chatbot|llm|machine learning)/.test(hay)) return 'ai';
  if (/(laptop|pc|computer|notebook)/.test(hay)) return 'laptop';
  if (/(headphone|earbud|audio|speaker)/.test(hay)) return 'audio';
  if (/(camera|lens|dslr|mirrorless)/.test(hay)) return 'camera';
  if (/(phone|smartphone|android|iphone)/.test(hay)) return 'smartphone';
  if (/(home|cook|kitchen|appliance|vacuum)/.test(hay)) return 'home';
  return 'general';
}

async function createPost({ link, primaryKeyword, language, audience, tone, tags, publishMode='publish' }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing');
  }
  // Crawl page
  const crawlRes = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0 (Astro-Cron)' } });
  if (!crawlRes.ok) throw new Error(`Cannot fetch link: ${crawlRes.status}`);
  const html = await crawlRes.text();
  const $ = cheerio.load(html);
  const title = $('meta[property="og:title"]').attr('content')
    || $('title').first().text().trim() || 'Sản phẩm';
  const description = $('meta[name="description"]').attr('content')
    || $('meta[property="og:description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content')
    || $('img').first().attr('src') || '';
  const bodyText = $('body').text().replace(/\s+/g,' ').trim().slice(0, 5000);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `Bạn là chuyên gia Content Marketing, SEO và Copywriting.
Hãy viết 1 bài review sản phẩm chuẩn SEO dựa trên thông tin đã crawl.
Yêu cầu:
- Ngôn ngữ: ${language}
- Đối tượng: ${audience}
- Giọng điệu: ${tone}
- Từ khóa chính: ${primaryKeyword || ''}
- Chèn link affiliate: ${link}

Thông tin crawl được:
- Tiêu đề trang: ${title}
- Mô tả trang: ${description}
- Văn bản trang (rút gọn): ${bodyText}

Hãy xuất ra nội dung dạng Markdown (~1200-1500 từ) theo cấu trúc:
# H1 (tiêu đề có từ khóa)
Meta description (150-160 ký tự)
Mở bài theo AIDA
## Giới thiệu sản phẩm
## Ưu điểm nổi bật (bullet points)
## Nhược điểm cần lưu ý
## Trải nghiệm thực tế / Ứng dụng
## So sánh với sản phẩm khác (bảng)
## Thông số kỹ thuật (bảng, nếu có)
## Kết luận & CTA (gắn link affiliate ở đầu/giữa/cuối)

- Dùng H2/H3 hợp lý, chèn từ khóa chính 4-6 lần một cách tự nhiên.
- Gợi ý alt text cho ảnh sản phẩm.
- Trả về CHỈ Markdown của bài (không kèm ghi chú khác).`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      { role: 'system', content: 'Bạn là chuyên gia viết bài SEO & affiliate. Hãy xuất Markdown sạch.' },
      { role: 'user', content: prompt }
    ]
  });
  const articleMd = completion.choices?.[0]?.message?.content || '# Bài viết';

  // Prepare paths
  const slugBase = slugify(title || link);
  const slug = slugBase || slugify(link);
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth()+1).padStart(2,'0');
  const category = detectCategory(title, link, primaryKeyword);

  // Thumbnail
  let imageRel = '';
  if (ogImage && /^https?:\/\//i.test(ogImage)) {
    const imgExtGuess = (ogImage.split('.').pop() || 'jpg').split('?')[0];
    const safeExt = /^(png|jpg|jpeg|webp|gif)$/i.test(imgExtGuess) ? imgExtGuess : 'jpg';
    const imageDir = path.join(__root, 'public', 'images', 'blog');
    ensureDir(imageDir);
    const imgName = `${slug}.${safeExt}`.replace(/[^a-z0-9.]/g, '');
    const imgPath = path.join(imageDir, imgName);
    try {
      await downloadImage(ogImage, imgPath);
      imageRel = `/images/blog/${imgName}`;
    } catch (e) {
      imageRel = `/images/blog/defaults/default.svg`;
    }
  } else {
    imageRel = `/images/blog/defaults/default.svg`;
  }

  // AI OG image
  let ogRel = '';
  try {
    const imgGen = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `Background image related to: ${title}. High quality, photographic or clean illustration, 1200x630.`,
      size: "1200x630"
    });
    const b64 = imgGen.data?.[0]?.b64_json;
    if (b64) {
      const buf = Buffer.from(b64, 'base64');
      const ogDir = path.join(__root, 'public', 'images', 'og');
      ensureDir(ogDir);
      const bgPath = path.join(ogDir, `${slug}-bg.png`);
      await fs.promises.writeFile(bgPath, buf);
      const finalPath = path.join(ogDir, `${slug}.png`);
      await sharp(bgPath).composite([{ input: ogSvgOverlay(title), top: 0, left: 0 }]).png().toFile(finalPath);
      ogRel = `/images/og/${slug}.png`;
    }
  } catch {}

  // Determine target dir: drafts or posts
  const baseDir = (publishMode === 'draft')
    ? path.join(__root, 'src', 'content', 'drafts', year, month)
    : path.join(__root, 'src', 'content', 'blog', year, month);
  ensureDir(baseDir);

  const fm = [
    '---',
    `title: "${String(title).replace(/"/g, '\\"')}"`,
    `description: "${String(description || `Review ${title}`).replace(/"/g, '\\"')}"`,
    `pubDate: "${now.toISOString()}"`,
    `category: "${category}"`,
    `tags: [${(Array.isArray(tags) ? tags : []).map(t => `"${String(t).replace(/"/g, '\\"')}"`).join(', ')}]`,
    imageRel ? `image: "${imageRel}"` : '',
    ogRel ? `ogImage: "${ogRel}"` : '',
    '---'
  ].filter(Boolean).join('\n');

  const fileName = `${slug}.md`;
  const filePath = path.join(baseDir, fileName);
  await fs.promises.writeFile(filePath, `${fm}\n\n${articleMd}\n`, 'utf8');

  return { slug, file: filePath, image: imageRel, ogImage: ogRel, category, publishMode };
}

// Load seeds/state
const seeds = readJson(seedsPath, { items: [] });
const state = readJson(statePath, { usedIndexes: [] });

function pickNextSeed() {
  // find first index not in usedIndexes (wrap if all used)
  for (let i = 0; i < seeds.items.length; i++) {
    if (!state.usedIndexes.includes(i)) return i;
  }
  // reset if all used
  state.usedIndexes = [];
  writeJson(statePath, state);
  return 0;
}

async function runOnce(publishMode='publish') {
  const idx = pickNextSeed();
  const item = seeds.items[idx];
  if (!item) {
    console.log('No seeds available. Add links to cron/seeds.json');
    return;
  }
  const payload = {
    link: item.link,
    primaryKeyword: item.primaryKeyword || '',
    language: seeds.language || 'vi',
    audience: seeds.audience || 'người dùng phổ thông',
    tone: seeds.tone || 'thân thiện',
    tags: seeds.tags || ['review','affiliate'],
    publishMode
  };
  try {
    const res = await createPost(payload);
    state.usedIndexes.push(idx);
    writeJson(statePath, state);
    console.log('✅ Created:', res);
  } catch (e) {
    console.error('❌ Failed create post:', e.message);
  }
}

// Schedule:
// Monday 09:00 -> publish
cron.schedule('0 9 * * 1', () => { runOnce('publish'); });
// Thursday 09:00 -> publish
cron.schedule('0 9 * * 4', () => { runOnce('publish'); });

// Also export simple CLI triggers:
// node cron/auto-post.mjs publish
// node cron/auto-post.mjs draft
const mode = process.argv[2];
if (mode === 'publish') {
  runOnce('publish');
} else if (mode === 'draft') {
  runOnce('draft');
} else {
  console.log('Cron worker loaded. Use "node cron/auto-post.mjs publish|draft" to run once.');
}