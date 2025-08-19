import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const siteUrl = 'https://example.com'; // Đổi sang domain thật

function generateSitemap() {
  const blogDir = path.join(process.cwd(), 'src/content/blog');
  const files = fs.readdirSync(blogDir);
  const pages = files.map(file => {
    const content = fs.readFileSync(path.join(blogDir, file), 'utf-8');
    const { data } = matter(content);
    return {
      url: `${siteUrl}/blog/${file.replace(/\.mdx?$/, '')}`,
      lastmod: data.date || new Date().toISOString()
    };
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `<url><loc>${p.url}</loc><lastmod>${p.lastmod}</lastmod></url>`).join('')}
</urlset>`;

  fs.writeFileSync(path.join(process.cwd(), 'public', 'sitemap.xml'), sitemap);
}

generateSitemap();