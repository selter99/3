import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const siteUrl = 'https://example.com';
const siteTitle = 'My Blog';
const siteDescription = 'Latest blog updates';

function generateRSS() {
  const blogDir = path.join(process.cwd(), 'src/content/blog');
  const files = fs.readdirSync(blogDir);
  const posts = files.map(file => {
    const content = fs.readFileSync(path.join(blogDir, file), 'utf-8');
    const { data, content: body } = matter(content);
    return {
      title: data.title,
      link: `${siteUrl}/blog/${file.replace(/\.mdx?$/, '')}`,
      date: data.date || new Date().toISOString(),
      description: data.description || body.substring(0, 150) + '...'
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
<title>${siteTitle}</title>
<link>${siteUrl}</link>
<description>${siteDescription}</description>
${posts.map(p => `<item><title>${p.title}</title><link>${p.link}</link><pubDate>${p.date}</pubDate><description>${p.description}</description></item>`).join('')}
</channel>
</rss>`;

  fs.writeFileSync(path.join(process.cwd(), 'public', 'rss.xml'), rss);
}

generateRSS();