/* OC 管理后台前端(原生 JS) */
const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

/* ---------- 标签页 ---------- */
$$('.tab').forEach((btn) =>
  btn.addEventListener('click', () => {
    $$('.tab').forEach((b) => b.classList.toggle('active', b === btn))
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${btn.dataset.tab}`))
    if (btn.dataset.tab === 'photos') initPhotos()
  }),
)

/* ================= 日记 ================= */
let currentId = null
let diaryCache = []

async function loadDiaryList(selectId) {
  diaryCache = await api('/api/diary')
  const ul = $('#post-list')
  ul.innerHTML = ''
  for (const p of diaryCache) {
    const li = document.createElement('li')
    li.innerHTML = `<div class="t"></div><div class="d"></div>`
    li.querySelector('.t').textContent = p.title
    li.querySelector('.d').textContent = p.date
    li.classList.toggle('active', p.id === (selectId ?? currentId))
    li.addEventListener('click', () => openPost(p.id))
    ul.appendChild(li)
  }
}

async function openPost(id) {
  const p = await api(`/api/diary/${id}`)
  currentId = id
  $('#editor-wrap').hidden = false
  $('#editor-empty').hidden = true
  $('#f-title').value = p.title
  $('#f-date').value = p.date
  $('#f-cover').value = p.cover
  $('#f-summary').value = p.summary
  $('#f-body').value = p.body.trim()
  renderPreview()
  $('#editor-status').textContent = ''
  await loadDiaryList(id)
}

function renderPreview() {
  $('#preview').innerHTML = marked.parse($('#f-body').value)
}

$('#f-body').addEventListener('input', renderPreview)

$('#btn-new-post').addEventListener('click', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const { id } = await api('/api/diary', {
    method: 'POST',
    body: { title: '未命名', date: today, cover: '', summary: '', body: '\n' },
  })
  await openPost(id)
  $('#f-title').focus()
  $('#f-title').select()
})

$('#btn-save').addEventListener('click', async () => {
  if (!currentId) return
  try {
    await api(`/api/diary/${currentId}`, {
      method: 'PUT',
      body: {
        title: $('#f-title').value,
        date: $('#f-date').value,
        cover: $('#f-cover').value,
        summary: $('#f-summary').value,
        body: $('#f-body').value,
      },
    })
    $('#editor-status').textContent = '已保存 ✓'
    await loadDiaryList()
  } catch (e) {
    $('#editor-status').textContent = `保存失败:${e.message}`
  }
})

$('#btn-delete').addEventListener('click', async () => {
  if (!currentId) return
  if (!confirm(`确定删除「${$('#f-title').value}」吗?文件将被永久删除。`)) return
  await api(`/api/diary/${currentId}`, { method: 'DELETE' })
  currentId = null
  $('#editor-wrap').hidden = true
  $('#editor-empty').hidden = false
  await loadDiaryList()
})

// 封面:从照片库选择
async function fillCoverPicker() {
  try {
    const photos = await api('/api/photos')
    const sel = $('#f-cover-pick')
    sel.innerHTML = '<option value="">照片库…</option>'
    for (const p of photos) {
      const opt = document.createElement('option')
      opt.value = p.url
      opt.textContent = `${p.title || p.id}`
      sel.appendChild(opt)
    }
    sel.onchange = () => {
      if (sel.value) $('#f-cover').value = sel.value
      sel.value = ''
    }
  } catch {
    /* 照片库不可用时忽略 */
  }
}

/* ================= 照片 ================= */
let photosInited = false

async function initPhotos() {
  await checkToken()
  await loadPhotoGrid()
  if (!photosInited) {
    photosInited = true
    await fillCoverPicker()
  }
}

async function checkToken() {
  const { configured } = await api('/api/config/status')
  $('#token-form').hidden = configured
}

$('#btn-token-save').addEventListener('click', async () => {
  const token = $('#token-input').value.trim()
  if (!token) return
  try {
    await api('/api/config/token', { method: 'POST', body: { token } })
    $('#token-input').value = ''
    $('#token-status').textContent = '已保存 ✓(token 已写入本机配置文件,不会显示)'
    $('#token-form').hidden = true
  } catch (e) {
    $('#token-status').textContent = `保存失败:${e.message}`
  }
})

async function loadPhotoGrid() {
  const photos = await api('/api/photos')
  const grid = $('#photo-grid')
  grid.innerHTML = ''
  for (const p of [...photos].reverse()) {
    const card = document.createElement('div')
    card.className = 'photo-card'
    card.innerHTML = `
      <img loading="lazy" alt="">
      <div class="body">
        <label>标题 <input data-k="title"></label>
        <label>日期 <input data-k="date" type="date"></label>
        <label>相册 <input data-k="album"></label>
        <label>描述 <input data-k="description"></label>
        <div class="url"></div>
        <div class="ops">
          <button class="btn primary save">保存</button>
          <button class="btn danger del">删除</button>
          <span class="status"></span>
        </div>
        <div class="note">删除仅移除 photos.json 记录,不会删除图床上的文件。</div>
      </div>`
    card.querySelector('img').src = p.url
    card.querySelector('.url').textContent = p.url
    for (const input of card.querySelectorAll('input')) input.value = p[input.dataset.k] || ''

    card.querySelector('.save').addEventListener('click', async () => {
      const body = {}
      for (const input of card.querySelectorAll('input')) body[input.dataset.k] = input.value
      try {
        await api(`/api/photos/${p.id}`, { method: 'PUT', body })
        card.querySelector('.status').textContent = '已保存 ✓'
        await fillCoverPicker()
      } catch (e) {
        card.querySelector('.status').textContent = `失败:${e.message}`
      }
    })

    card.querySelector('.del').addEventListener('click', async () => {
      if (!confirm(`确定删除「${p.title || p.id}」这条记录吗?(图床文件保留)`)) return
      await api(`/api/photos/${p.id}`, { method: 'DELETE' })
      await loadPhotoGrid()
      await fillCoverPicker()
    })

    grid.appendChild(card)
  }
}

/* ---------- 上传 ---------- */
const dz = $('#dropzone')
const fileInput = $('#file-input')

;['dragenter', 'dragover'].forEach((ev) =>
  dz.addEventListener(ev, (e) => {
    e.preventDefault()
    dz.classList.add('over')
  }),
)
;['dragleave', 'drop'].forEach((ev) =>
  dz.addEventListener(ev, (e) => {
    e.preventDefault()
    dz.classList.remove('over')
  }),
)
dz.addEventListener('drop', (e) => uploadFiles(e.dataTransfer.files))
fileInput.addEventListener('change', () => {
  uploadFiles(fileInput.files)
  fileInput.value = ''
})

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

async function uploadFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    $('#upload-status').textContent = `正在上传 ${file.name} …`
    try {
      const base64 = await fileToBase64(file)
      const { entry } = await api('/api/upload', {
        method: 'POST',
        body: { filename: file.name, base64, title: file.name.replace(/\.\w+$/, '') },
      })
      $('#upload-status').textContent = `已上传并登记:${entry.title} ✓`
    } catch (e) {
      $('#upload-status').textContent = `上传 ${file.name} 失败:${e.message}`
    }
  }
  await loadPhotoGrid()
  await fillCoverPicker()
}

/* ================= 同步 ================= */
$('#btn-sync').addEventListener('click', async () => {
  const btn = $('#btn-sync')
  const out = $('#sync-output')
  btn.disabled = true
  out.textContent = '正在同步,请稍候…'
  try {
    const { output } = await api('/api/sync', { method: 'POST' })
    out.textContent = output || '(无输出)'
  } catch (e) {
    out.textContent = `同步失败:${e.message}`
  } finally {
    btn.disabled = false
  }
})

/* ---------- 启动 ---------- */
loadDiaryList()
checkToken()
fillCoverPicker()
