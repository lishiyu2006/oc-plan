/**
 * OC · 照片日记 —— 本地管理后台(零第三方依赖,仅 Node 内置模块)
 * 启动:npm run admin  或  node admin/server.mjs
 * 监听:http://localhost:3777
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync, execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIARY_DIR = path.join(ROOT, 'content', 'diary')
const PHOTOS_JSON = path.join(ROOT, 'content', 'photos.json')
const CONFIG_PATH = path.join(__dirname, 'config.local.json')
const PUBLIC_DIR = path.join(__dirname, 'public')
const PORT = 3777

// 图床目标(固定)
const GH_REPO = 'lishiyu2006/picgo'
const GH_BRANCH = 'main'
const GH_DIR = 'img'
const CDN_BASE = `https://cdn.jsdelivr.net/gh/${GH_REPO}@${GH_BRANCH}/${GH_DIR}`

/* ---------------- token 配置(安全:值永不打印、永不回显) ---------------- */
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  } catch {
    return null
  }
}

function saveToken(token) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ githubToken: token }, null, 2) + '\n')
}

function bootstrapToken() {
  if (loadConfig()?.githubToken) return true
  // 首次启动:尝试从 PicGo 的 data.json 中编程读取目标仓库的 token
  try {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    const picgoFile = path.join(appData, 'picgo', 'data.json')
    const data = JSON.parse(fs.readFileSync(picgoFile, 'utf8'))
    const list = data?.uploader?.github?.configList || []
    const hit = list.find((c) => c.repo === GH_REPO && typeof c.token === 'string' && c.token)
    if (hit) {
      saveToken(hit.token)
      console.log('[admin] 已从 PicGo 配置导入图床 token(出于安全不会显示其值)。')
      return true
    }
  } catch {
    /* 读不到就留给页面手动填写 */
  }
  return false
}

/* ---------------- 小工具 ---------------- */
function today() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

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

function fmValue(v) {
  const s = String(v ?? '')
  return /[:#"\n]/.test(s) || s === '' ? JSON.stringify(s) : s
}

function buildMarkdown({ title, date, cover, summary, body }) {
  return (
    `---\n` +
    `title: ${fmValue(title)}\n` +
    `date: ${fmValue(date)}\n` +
    `cover: ${fmValue(cover)}\n` +
    `summary: ${fmValue(summary)}\n` +
    `---\n\n` +
    `${(body || '').replace(/\s+$/, '')}\n`
  )
}

function readBody(req, limit = 40 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function json(res, status, obj) {
  const s = JSON.stringify(obj)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(s)
}

const safeId = (id) => /^[\w-]+$/.test(id || '')

/* ---------------- 日记 ---------------- */
function listDiary() {
  return fs
    .readdirSync(DIARY_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { data } = parseFrontmatter(fs.readFileSync(path.join(DIARY_DIR, f), 'utf8'))
      const id = f.replace(/\.md$/, '')
      return { id, title: data.title || id, date: data.date || '', summary: data.summary || '' }
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

function uniqueDiaryName(date, title) {
  let slug = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    slug = `post-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  }
  let name = `${date}-${slug}`
  let i = 2
  while (fs.existsSync(path.join(DIARY_DIR, `${name}.md`))) name = `${date}-${slug}-${i++}`
  return name
}

/* ---------------- 照片 ---------------- */
function readPhotos() {
  return JSON.parse(fs.readFileSync(PHOTOS_JSON, 'utf8'))
}

function writePhotos(list) {
  fs.writeFileSync(PHOTOS_JSON, JSON.stringify(list, null, 2) + '\n')
}

function nextPhotoId(list) {
  let max = 0
  for (const p of list) {
    const m = /^p-(\d+)$/.exec(p.id || '')
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `p-${String(max + 1).padStart(3, '0')}`
}

async function ghRequest(method, apiPath, body, token) {
  return fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'oc-photo-diary-admin',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function uploadToGitHub(filename, base64, token) {
  let name = path.basename(filename).replace(/[^\w.-]+/g, '-')
  if (!/\.[a-z0-9]+$/i.test(name)) name += '.jpg'

  // 文件名冲突检测:已存在则加时间戳前缀
  const check = await ghRequest(
    'GET',
    `/repos/${GH_REPO}/contents/${GH_DIR}/${name}?ref=${GH_BRANCH}`,
    null,
    token,
  )
  if (check.ok) name = `${Date.now()}-${name}`
  await check.arrayBuffer().catch(() => {})

  const put = await ghRequest(
    'PUT',
    `/repos/${GH_REPO}/contents/${GH_DIR}/${name}`,
    { message: `Upload ${name} via admin panel`, content: base64, branch: GH_BRANCH },
    token,
  )
  if (!put.ok) {
    const text = await put.text().catch(() => '')
    throw new Error(`GitHub 上传失败(HTTP ${put.status}):${text.slice(0, 200)}`)
  }
  await put.arrayBuffer().catch(() => {})
  return { name, url: `${CDN_BASE}/${name}` }
}

/* ---------------- 静态文件 ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
}

function serveFile(res, file) {
  try {
    const buf = fs.readFileSync(file)
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
    res.end(buf)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
}

/* ---------------- 路由 ---------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const p = url.pathname

  try {
    // 静态资源
    if (req.method === 'GET' && p === '/') return serveFile(res, path.join(PUBLIC_DIR, 'index.html'))
    if (req.method === 'GET' && (p === '/app.js' || p === '/style.css'))
      return serveFile(res, path.join(PUBLIC_DIR, p.slice(1)))
    if (req.method === 'GET' && p === '/vendor/marked.min.js')
      return serveFile(res, path.join(ROOT, 'node_modules', 'marked', 'marked.min.js'))

    // 配置状态(只返回布尔,绝不返回 token 值)
    if (p === '/api/config/status' && req.method === 'GET')
      return json(res, 200, { configured: !!loadConfig()?.githubToken })

    if (p === '/api/config/token' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8') || '{}')
      if (typeof body.token !== 'string' || body.token.trim().length < 10)
        return json(res, 400, { error: 'token 格式不正确' })
      saveToken(body.token.trim())
      return json(res, 200, { ok: true })
    }

    // 日记 API
    if (p === '/api/diary' && req.method === 'GET') return json(res, 200, listDiary())

    const diaryMatch = p.match(/^\/api\/diary\/([\w-]+)$/)
    if (diaryMatch) {
      const id = diaryMatch[1]
      if (!safeId(id)) return json(res, 400, { error: '非法 id' })
      const file = path.join(DIARY_DIR, `${id}.md`)

      if (req.method === 'GET') {
        if (!fs.existsSync(file)) return json(res, 404, { error: '日记不存在' })
        const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
        return json(res, 200, {
          id,
          title: data.title || '',
          date: data.date || '',
          cover: data.cover || '',
          summary: data.summary || '',
          body,
        })
      }
      if (req.method === 'PUT') {
        if (!fs.existsSync(file)) return json(res, 404, { error: '日记不存在' })
        const b = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        fs.writeFileSync(file, buildMarkdown(b))
        return json(res, 200, { ok: true, id })
      }
      if (req.method === 'DELETE') {
        if (!fs.existsSync(file)) return json(res, 404, { error: '日记不存在' })
        fs.unlinkSync(file)
        return json(res, 200, { ok: true })
      }
    }

    if (p === '/api/diary' && req.method === 'POST') {
      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}')
      const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : today()
      const id = uniqueDiaryName(date, b.title)
      fs.writeFileSync(path.join(DIARY_DIR, `${id}.md`), buildMarkdown({ ...b, date }))
      return json(res, 200, { ok: true, id })
    }

    // 照片 API
    if (p === '/api/photos' && req.method === 'GET') return json(res, 200, readPhotos())

    const photoMatch = p.match(/^\/api\/photos\/([\w-]+)$/)
    if (photoMatch) {
      const id = photoMatch[1]
      const list = readPhotos()
      const idx = list.findIndex((x) => x.id === id)
      if (idx === -1) return json(res, 404, { error: '照片不存在' })

      if (req.method === 'PUT') {
        const b = JSON.parse((await readBody(req)).toString('utf8') || '{}')
        for (const k of ['title', 'description', 'album', 'date'])
          if (typeof b[k] === 'string') list[idx][k] = b[k]
        writePhotos(list)
        return json(res, 200, { ok: true, entry: list[idx] })
      }
      if (req.method === 'DELETE') {
        // 仅删除 photos.json 记录,不删除图床文件
        list.splice(idx, 1)
        writePhotos(list)
        return json(res, 200, { ok: true })
      }
    }

    // 上传到图床并自动登记
    if (p === '/api/upload' && req.method === 'POST') {
      const token = loadConfig()?.githubToken
      if (!token) return json(res, 401, { error: '未配置 GitHub token,请先在页面上填写' })

      const b = JSON.parse((await readBody(req)).toString('utf8') || '{}')
      if (!b.filename || !b.base64) return json(res, 400, { error: '缺少 filename 或 base64' })

      const { name, url: imgUrl } = await uploadToGitHub(b.filename, b.base64, token)

      const list = readPhotos()
      const entry = {
        id: nextPhotoId(list),
        title: typeof b.title === 'string' && b.title ? b.title : name.replace(/\.\w+$/, ''),
        url: imgUrl,
        date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : today(),
        album: typeof b.album === 'string' ? b.album : '',
        description: typeof b.description === 'string' ? b.description : '',
      }
      list.push(entry)
      writePhotos(list)
      return json(res, 200, { ok: true, entry })
    }

    // 一键同步
    if (p === '/api/sync' && req.method === 'POST') {
      const git = (args) =>
        execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

      const status = git(['status', '--porcelain', '--', 'content/']).trim()
      if (!status) return json(res, 200, { ok: true, output: '没有需要同步的内容 ✨' })

      const out = []
      out.push('$ git add content/')
      git(['add', 'content/'])
      const msg = `content: update ${new Date().toISOString()}`
      out.push(`$ git commit -m "${msg}"`)
      out.push(git(['commit', '-m', msg]).trim())
      try {
        out.push('$ git push')
        out.push(git(['push']).trim() || '(push 输出为空,通常表示成功)')
      } catch (e1) {
        try {
          out.push('$ git push -u origin HEAD(push 失败,尝试设置上游)')
          out.push(git(['push', '-u', 'origin', 'HEAD']).trim() || '(成功)')
        } catch (e2) {
          out.push(`push 失败:${(e2.stderr || e2.message || '').toString().split('\n')[0]}`)
          return json(res, 200, { ok: false, output: out.filter(Boolean).join('\n') })
        }
      }
      return json(res, 200, { ok: true, output: out.filter(Boolean).join('\n') })
    }

    json(res, 404, { error: 'not found' })
  } catch (e) {
    json(res, 500, { error: String(e.message || e).slice(0, 300) })
  }
})

const hasToken = bootstrapToken()
if (!hasToken)
  console.log('[admin] 未找到图床 token,请在管理后台「照片」页手动粘贴 GitHub token。')

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`
  console.log(`[admin] 管理后台已启动: ${url}`)
  console.log('[admin] 按 Ctrl + C 停止。')
  // 自动打开浏览器(仅 Windows;失败不影响使用)
  if (process.platform === 'win32') {
    execFile('cmd.exe', ['/c', 'start', '', url], () => {})
  }
})
