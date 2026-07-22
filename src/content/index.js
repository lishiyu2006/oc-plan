import { marked } from 'marked'
import photosData from '../../content/photos.json'

// ---------- 日记:构建期收集 content/diary/*.md ----------
const mdFiles = import.meta.glob('../../content/diary/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// 极简 frontmatter 解析(支持 key: value 单行字段)
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { data: {}, body: raw }
  const data = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/)
    if (kv) data[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return { data, body: m[2] }
}

export const diaryPosts = Object.entries(mdFiles)
  .map(([path, raw]) => {
    const { data, body } = parseFrontmatter(raw)
    const id = path.split('/').pop().replace(/\.md$/, '')
    return {
      id,
      title: data.title || id,
      date: data.date || '',
      cover: data.cover || '',
      summary: data.summary || '',
      html: marked.parse(body),
    }
  })
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

export function getPost(id) {
  return diaryPosts.find((p) => p.id === id)
}

// ---------- 照片 ----------
export const photos = [...photosData].sort((a, b) =>
  (b.date || '').localeCompare(a.date || ''),
)

export const albums = [...new Set(photos.map((p) => p.album).filter(Boolean))]

// ---------- 阅读记录(需同意后才持久化) ----------
export function getReadPosts() {
  try {
    return JSON.parse(localStorage.getItem('read-posts') || '[]')
  } catch {
    return []
  }
}

export function markPostRead(id) {
  try {
    const list = getReadPosts()
    if (!list.includes(id)) {
      list.push(id)
      localStorage.setItem('read-posts', JSON.stringify(list))
    }
  } catch {
    /* ignore */
  }
}
