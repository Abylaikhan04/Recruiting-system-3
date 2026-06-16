/**
 * RecruitFlow — Node.js/Express backend (sql.js edition)
 * Pure-JS SQLite — no native compilation needed.
 * Replaces `php artisan serve` on corporate machines where PHP can't open sockets.
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const pdfParse = require('pdf-parse')

const { aiAnalyze } = require('./services/ai')

const app = express()
const PORT = process.env.PORT || 8000

// ─── DB (sql.js wrapper) ──────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'database', 'database.sqlite')
let _raw = null // sql.js Database instance

function stmtRow(stmt) {
  const cols = stmt.getColumnNames()
  const vals = stmt.get()
  const obj = {}
  cols.forEach((c, i) => { obj[c] = vals[i] })
  return obj
}

// Thin wrapper: db.prepare(sql).get(...params) / .all(...params) / .run(...params)
const db = {
  _save() {
    const data = _raw.export()
    fs.writeFileSync(DB_PATH, Buffer.from(data))
  },
  prepare(sql) {
    return {
      get: (...args) => {
        const p = args.flat().map(v => v === undefined ? null : v)
        const stmt = _raw.prepare(sql)
        stmt.bind(p)
        const row = stmt.step() ? stmtRow(stmt) : null
        stmt.free()
        return row
      },
      all: (...args) => {
        const p = args.flat().map(v => v === undefined ? null : v)
        const stmt = _raw.prepare(sql)
        stmt.bind(p)
        const rows = []
        while (stmt.step()) rows.push(stmtRow(stmt))
        stmt.free()
        return rows
      },
      run: (...args) => {
        const p = args.flat().map(v => v === undefined ? null : v)
        const stmt = _raw.prepare(sql)
        stmt.bind(p)
        stmt.step()
        stmt.free()
        const r = _raw.exec('SELECT last_insert_rowid()')
        const lastInsertRowid = r[0]?.values[0][0] ?? null
        db._save()
        return { lastInsertRowid }
      },
    }
  },
}

function initDb() {
  return new Promise((resolve, reject) => {
    require('sql.js')().then(SQL => {
      const buf = fs.readFileSync(DB_PATH)
      _raw = new SQL.Database(buf)
      _raw.run('PRAGMA foreign_keys = ON')
      // Migrations: add columns if not exist (safe - fails silently if already present)
      try { _raw.run("ALTER TABLE vacancies ADD COLUMN priority TEXT DEFAULT 'medium'") } catch(e) {}
      try { _raw.run("ALTER TABLE candidates ADD COLUMN age INTEGER") } catch(e) {}
      try { _raw.run("ALTER TABLE candidates ADD COLUMN telegram TEXT") } catch(e) {}
      resolve()
    }).catch(reject)
  })
}

// ─── CORS / body ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

// ─── AUTH HELPERS ──────────────────────────────────────────────────────────────
function hashToken(plain) {
  return crypto.createHash('sha256').update(plain).digest('hex')
}

function createToken(userId) {
  const plain = crypto.randomBytes(40).toString('hex')
  const hashed = hashToken(plain)
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO personal_access_tokens (tokenable_type,tokenable_id,name,token,abilities,created_at,updated_at) VALUES (?,?,'auth-token',?,'["*"]',?,?)`).run('App\\Models\\User', userId, hashed, now, now)
  const row = db.prepare('SELECT id FROM personal_access_tokens WHERE token = ?').get(hashed)
  return `${row.id}|${plain}`
}

function getUserFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const fullToken = authHeader.slice(7)
  const pipeIdx = fullToken.indexOf('|')
  if (pipeIdx === -1) return null
  const id = parseInt(fullToken.slice(0, pipeIdx))
  const plain = fullToken.slice(pipeIdx + 1)
  const pat = db.prepare('SELECT * FROM personal_access_tokens WHERE id = ? AND token = ?').get(id, hashToken(plain))
  if (!pat) return null
  db.prepare('UPDATE personal_access_tokens SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), pat.id)
  return db.prepare('SELECT * FROM users WHERE id = ?').get(pat.tokenable_id)
}

function auth(req, res, next) {
  const user = getUserFromToken(req.headers.authorization)
  if (!user) return res.status(401).json({ message: 'Unauthenticated.' })
  req.user = user
  next()
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden.' })
  next()
}

function tryParse(v, fallback) {
  if (!v) return fallback
  try { return JSON.parse(v) } catch { return fallback }
}

// AI is extracted to services/ai.js

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.get('/api', (req, res) => res.json({ status: 'ok', app: 'RecruitFlow API (Node.js)' }))

// Auth
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(422).json({ message: 'Email и пароль обязательны' })
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user) return res.status(401).json({ message: 'Неверные данные для входа.' })
  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return res.status(401).json({ message: 'Неверные данные для входа.' })
  const token = createToken(user.id)
  const { password: _, ...safe } = user
  res.json({ token, user: safe })
})

app.get('/api/me', auth, (req, res) => {
  const { password: _, ...safe } = req.user
  const dept = req.user.department_id ? db.prepare('SELECT * FROM departments WHERE id = ?').get(req.user.department_id) : null
  res.json({ ...safe, department: dept })
})

app.post('/api/logout', auth, (req, res) => {
  const t = req.headers.authorization.slice(7); const i = t.indexOf('|')
  db.prepare('DELETE FROM personal_access_tokens WHERE id = ? AND token = ?').run(parseInt(t.slice(0, i)), hashToken(t.slice(i + 1)))
  res.json({ message: 'Logged out.' })
})

// Dashboard
app.get('/api/dashboard', auth, (req, res) => {
  const adm = req.user.role === 'admin'; const uid = req.user.id
  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7) + '-01'
  const now = new Date().toISOString()
  const openVac = db.prepare(`SELECT COUNT(*) as c FROM vacancies WHERE status='open'${adm ? '' : ' AND recruiter_id=?'}`).get(...(adm ? [] : [uid])).c
  const total = db.prepare(`SELECT COUNT(*) as c FROM candidates${adm ? '' : ' WHERE recruiter_id=?'}`).get(...(adm ? [] : [uid])).c
  const interviews = db.prepare(`SELECT COUNT(*) as c FROM meetings WHERE date(starts_at)=?${adm ? '' : ' AND user_id=?'}`).get(...(adm ? [today] : [today, uid])).c
  const hired = db.prepare(`SELECT COUNT(*) as c FROM candidates WHERE stage='hired' AND date(updated_at)>=?${adm ? '' : ' AND recruiter_id=?'}`).get(...(adm ? [month] : [month, uid])).c
  const pending = db.prepare(`SELECT COUNT(*) as c FROM hiring_requests WHERE status='pending'`).get().c
  const meetings = db.prepare(`SELECT m.*,c.full_name as candidate_name FROM meetings m LEFT JOIN candidates c ON m.candidate_id=c.id WHERE m.starts_at>=?${adm ? '' : ' AND m.user_id=?'} ORDER BY m.starts_at ASC LIMIT 5`).all(...(adm ? [now] : [now, uid]))
  const recent = db.prepare(`SELECT c.*,u.name as recruiter_name,v.title as vacancy_title FROM candidates c LEFT JOIN users u ON c.recruiter_id=u.id LEFT JOIN vacancies v ON c.vacancy_id=v.id${adm ? '' : ' WHERE c.recruiter_id=?'} ORDER BY c.updated_at DESC LIMIT 8`).all(...(adm ? [] : [uid]))
  res.json({ metrics: { open_vacancies: openVac, total_candidates: total, interviews_today: interviews, hired_this_month: hired, pending_requests: pending }, upcoming_meetings: meetings, recent_candidates: recent })
})

// Candidates
app.get('/api/candidates', auth, (req, res) => {
  const { search, stage, source, recruiter_id, organization, city, vacancy_id, page = 1, per_page = 20 } = req.query
  const adm = req.user.role === 'admin'; let where = []; let params = []
  if (!adm) { where.push(`c.recruiter_id = ?`); params.push(req.user.id) }
  if (adm && recruiter_id) { where.push(`c.recruiter_id = ?`); params.push(recruiter_id) }
  if (stage) { where.push(`c.stage = ?`); params.push(stage) }
  if (source) { where.push(`c.source = ?`); params.push(source) }
  if (organization) { where.push(`c.organization = ?`); params.push(organization) }
  if (city) { where.push(`c.city = ?`); params.push(city) }
  if (vacancy_id) { where.push(`c.vacancy_id = ?`); params.push(vacancy_id) }
  if (search) { where.push(`(c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.position LIKE ?)`); const q = `%${search}%`; params.push(q, q, q, q) }
  const ws = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const offset = (parseInt(page) - 1) * parseInt(per_page)
  const total = db.prepare(`SELECT COUNT(*) as c FROM candidates c ${ws}`).get(...params).c
  const data = db.prepare(`SELECT c.*,u.name as recruiter_name,v.title as vacancy_title,(SELECT score FROM ai_analyses WHERE candidate_id=c.id ORDER BY created_at DESC LIMIT 1) as ai_score,(SELECT id FROM ai_analyses WHERE candidate_id=c.id ORDER BY created_at DESC LIMIT 1) as ai_id FROM candidates c LEFT JOIN users u ON c.recruiter_id=u.id LEFT JOIN vacancies v ON c.vacancy_id=v.id ${ws} ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(per_page), offset).map(c => ({
    ...c,
    recruiter: c.recruiter_id ? { id: c.recruiter_id, name: c.recruiter_name } : null,
    vacancy: c.vacancy_id ? { id: c.vacancy_id, title: c.vacancy_title } : null,
    latest_analysis: c.ai_score != null ? { id: c.ai_id, score: c.ai_score } : null,
  }))
  res.json({ data, meta: { total, per_page: parseInt(per_page), current_page: parseInt(page), last_page: Math.ceil(total / parseInt(per_page)) } })
})

app.get('/api/candidates/:id', auth, (req, res) => {
  let c = db.prepare(`SELECT c.*,u.name as recruiter_name,v.title as vacancy_title FROM candidates c LEFT JOIN users u ON c.recruiter_id=u.id LEFT JOIN vacancies v ON c.vacancy_id=v.id WHERE c.id=?`).get(parseInt(req.params.id))
  if (!c) return res.status(404).json({ message: 'Не найден' })
  c = { ...c, recruiter: c.recruiter_id ? { id: c.recruiter_id, name: c.recruiter_name } : null, vacancy: c.vacancy_id ? { id: c.vacancy_id, title: c.vacancy_title } : null }
  c.notes = db.prepare(`SELECT n.*,u.name as user_name FROM candidate_notes n LEFT JOIN users u ON n.user_id=u.id WHERE n.candidate_id=? ORDER BY n.created_at ASC`).all(c.id)
  c.history = db.prepare(`SELECT h.*,u.name as user_name FROM candidate_history h LEFT JOIN users u ON h.user_id=u.id WHERE h.candidate_id=? ORDER BY h.created_at DESC`).all(c.id)
  c.analyses = db.prepare(`SELECT a.*,u.name as user_name FROM ai_analyses a LEFT JOIN users u ON a.created_by=u.id WHERE a.candidate_id=? ORDER BY a.created_at DESC`).all(c.id).map(a => ({ ...a, strengths: tryParse(a.strengths, []), risks: tryParse(a.risks, []), questions: tryParse(a.questions, []) }))
  res.json(c)
})

app.post('/api/candidates', auth, (req, res) => {
  const b = req.body; const now = new Date().toISOString()
  const recruiter_id = (req.user.role === 'admin' && b.recruiter_id) ? parseInt(b.recruiter_id) : req.user.id
  const ins = db.prepare(`INSERT INTO candidates (full_name,phone,email,organization,city,department,position,source,stage,status,rejection_reason,comment,resume_text,resume_url,vacancy_id,recruiter_id,age,telegram,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(b.full_name, b.phone||null, b.email||null, b.organization||'Alina Group', b.city||null, b.department||null, b.position, b.source||null, b.stage||'new', b.status||'active', b.rejection_reason||null, b.comment||null, b.resume_text||null, b.resume_url||null, b.vacancy_id||null, recruiter_id, b.age||null, b.telegram||null, now, now)
  res.status(201).json(db.prepare('SELECT * FROM candidates WHERE id=?').get(ins.lastInsertRowid))
})

app.put('/api/candidates/:id', auth, (req, res) => {
  const cand = db.prepare('SELECT * FROM candidates WHERE id=?').get(parseInt(req.params.id))
  if (!cand) return res.status(404).json({ message: 'Не найден' })
  const now = new Date().toISOString(); const b = req.body
  if (b.stage && b.stage !== cand.stage) db.prepare(`INSERT INTO candidate_history (candidate_id,user_id,field,from_value,to_value,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).run(cand.id, req.user.id, 'stage', cand.stage, b.stage, now, now)
  const fields = ['full_name','phone','email','organization','city','department','position','source','stage','status','rejection_reason','comment','resume_text','resume_url','vacancy_id','age','telegram']
  const upd = fields.filter(f => b[f] !== undefined); if (!upd.length) return res.json(cand)
  db.prepare(`UPDATE candidates SET ${upd.map(f => f+'=?').join(',')},updated_at=? WHERE id=?`).run(...upd.map(f => b[f]), now, req.params.id)
  res.json(db.prepare('SELECT * FROM candidates WHERE id=?').get(parseInt(req.params.id)))
})

app.delete('/api/candidates/:id', auth, (req, res) => {
  db.prepare('DELETE FROM candidates WHERE id=?').run(parseInt(req.params.id)); res.json({ message: 'Удалён' })
})

app.post('/api/candidates/bulk-import', auth, (req, res) => {
  const { candidates } = req.body; if (!Array.isArray(candidates)) return res.status(422).json({ message: 'candidates must be array' })
  const now = new Date().toISOString(); let created = 0
  for (const b of candidates) {
    if (!b.full_name || !b.position) continue
    db.prepare(`INSERT INTO candidates (full_name,phone,email,position,city,source,stage,status,resume_text,resume_url,vacancy_id,recruiter_id,organization,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(b.full_name, b.phone||null, b.email||null, b.position, b.city||null, b.source||'manual', b.stage||'new', 'active', b.resume_text||null, b.resume_url||null, b.vacancy_id||null, req.user.id, 'Alina Group', now, now)
    created++
  }
  res.json({ created, message: `Импортировано: ${created}` })
})

app.post('/api/candidates/:id/analyze', auth, async (req, res) => {
  try {
    const c = db.prepare('SELECT * FROM candidates WHERE id=?').get(parseInt(req.params.id))
    if (!c) return res.status(404).json({ message: 'Не найден' })
    const vacancyId = req.body.vacancy_id || c.vacancy_id
    const v = vacancyId ? db.prepare('SELECT * FROM vacancies WHERE id=?').get(vacancyId) : null
    const r = await aiAnalyze(c, v); const now = new Date().toISOString()
    const ins = db.prepare(`INSERT INTO ai_analyses (candidate_id,score,summary,strengths,risks,questions,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(c.id, r.score, r.summary, JSON.stringify(r.strengths), JSON.stringify(r.risks), JSON.stringify(r.questions), req.user.id, now, now)
    res.json({ ...r, id: ins.lastInsertRowid })
  } catch (err) {
    console.error('analyze error:', err.message)
    res.status(500).json({ message: 'Ошибка анализа: ' + err.message })
  }
})

app.post('/api/candidates/analyze-selected', auth, async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) return res.status(422).json({ message: 'ids required' })
    const now = new Date().toISOString(); let count = 0; const results = []
    for (const id of ids) {
      const c = db.prepare('SELECT * FROM candidates WHERE id=?').get(parseInt(id))
      if (!c) continue
      const v = c.vacancy_id ? db.prepare('SELECT * FROM vacancies WHERE id=?').get(c.vacancy_id) : null
      const r = await aiAnalyze(c, v)
      const ins = db.prepare(`INSERT INTO ai_analyses (candidate_id,score,summary,strengths,risks,questions,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(c.id, r.score, r.summary, JSON.stringify(r.strengths), JSON.stringify(r.risks), JSON.stringify(r.questions), req.user.id, now, now)
      results.push({ id: c.id, score: r.score })
      count++
    }
    res.json({ analyzed: count, results, message: `Проанализировано: ${count} кандидатов` })
  } catch (err) {
    console.error('analyze-selected error:', err.message)
    res.status(500).json({ message: 'Ошибка анализа: ' + err.message })
  }
})

app.post('/api/candidates/analyze-batch', auth, async (req, res) => {
  try {
    const { limit = 50 } = req.body; const adm = req.user.role === 'admin'
    const candidates = db.prepare(`SELECT * FROM candidates${adm ? '' : ` WHERE recruiter_id=${req.user.id}`} ORDER BY created_at DESC LIMIT ?`).all(parseInt(limit))
    const now = new Date().toISOString(); let count = 0
    for (const c of candidates) {
      const v = c.vacancy_id ? db.prepare('SELECT * FROM vacancies WHERE id=?').get(c.vacancy_id) : null
      const r = await aiAnalyze(c, v)
      db.prepare(`INSERT INTO ai_analyses (candidate_id,score,summary,strengths,risks,questions,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(c.id, r.score, r.summary, JSON.stringify(r.strengths), JSON.stringify(r.risks), JSON.stringify(r.questions), req.user.id, now, now)
      count++
    }
    res.json({ analyzed: count, message: `Проанализировано: ${count} кандидатов` })
  } catch (err) {
    console.error('analyze-batch error:', err.message)
    res.status(500).json({ message: 'Ошибка пакетного анализа: ' + err.message })
  }
})

app.post('/api/candidates/:id/notes', auth, (req, res) => {
  const { type = 'note', direction = null, body } = req.body
  if (!body) return res.status(422).json({ message: 'body required' })
  const now = new Date().toISOString()
  const ins = db.prepare(`INSERT INTO candidate_notes (candidate_id,user_id,type,direction,body,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).run(parseInt(req.params.id), req.user.id, type, direction, body, now, now)
  res.status(201).json(db.prepare('SELECT * FROM candidate_notes WHERE id=?').get(ins.lastInsertRowid))
})

// Vacancies
app.get('/api/vacancies', auth, (req, res) => {
  const adm = req.user.role === 'admin'
  const rows = db.prepare(`SELECT v.*,d.name as department_name,u.name as recruiter_name,(SELECT COUNT(*) FROM candidates WHERE vacancy_id=v.id) as candidates_count FROM vacancies v LEFT JOIN departments d ON v.department_id=d.id LEFT JOIN users u ON v.recruiter_id=u.id${adm ? '' : ' WHERE v.recruiter_id=?'} ORDER BY v.created_at DESC`).all(...(adm ? [] : [req.user.id]))
  res.json(rows.map(v => ({ ...v, recruiter: v.recruiter_id ? { id: v.recruiter_id, name: v.recruiter_name } : null, department: v.department_id ? { id: v.department_id, name: v.department_name } : null })))
})

app.get('/api/vacancies/:id', auth, (req, res) => {
  const v = db.prepare(`SELECT v.*,d.name as department_name,u.name as recruiter_name FROM vacancies v LEFT JOIN departments d ON v.department_id=d.id LEFT JOIN users u ON v.recruiter_id=u.id WHERE v.id=?`).get(parseInt(req.params.id))
  if (!v) return res.status(404).json({ message: 'Не найдена' })
  const candidates = db.prepare(`SELECT c.*,u2.name as recruiter_name,(SELECT score FROM ai_analyses WHERE candidate_id=c.id ORDER BY created_at DESC LIMIT 1) as ai_score,(SELECT id FROM ai_analyses WHERE candidate_id=c.id ORDER BY created_at DESC LIMIT 1) as ai_id FROM candidates c LEFT JOIN users u2 ON c.recruiter_id=u2.id WHERE c.vacancy_id=? ORDER BY c.updated_at DESC`).all(parseInt(req.params.id)).map(c => ({ ...c, recruiter: c.recruiter_id ? { id: c.recruiter_id, name: c.recruiter_name } : null, latest_analysis: c.ai_score != null ? { id: c.ai_id, score: c.ai_score } : null }))
  res.json({ ...v, recruiter: v.recruiter_id ? { id: v.recruiter_id, name: v.recruiter_name } : null, department: v.department_id ? { id: v.department_id, name: v.department_name } : null, candidates })
})

app.post('/api/vacancies', auth, (req, res) => {
  const b = req.body; const now = new Date().toISOString()
  const ins = db.prepare(`INSERT INTO vacancies (title,department_id,city,position,salary_range,description,requirements,priority,status,hiring_request_id,recruiter_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(b.title, b.department_id||null, b.city||null, b.position||null, b.salary_range||null, b.description||null, b.requirements||null, b.priority||'medium', b.status||'open', b.hiring_request_id||null, req.user.id, now, now)
  res.status(201).json(db.prepare('SELECT * FROM vacancies WHERE id=?').get(ins.lastInsertRowid))
})

app.put('/api/vacancies/:id', auth, (req, res) => {
  const b = req.body; const now = new Date().toISOString()
  const fs2 = ['title','department_id','city','position','salary_range','description','requirements','priority','status']
  const upd = fs2.filter(f => b[f] !== undefined)
  if (upd.length) db.prepare(`UPDATE vacancies SET ${upd.map(f=>f+'=?').join(',')},updated_at=? WHERE id=?`).run(...upd.map(f => b[f]), now, req.params.id)
  res.json(db.prepare('SELECT * FROM vacancies WHERE id=?').get(parseInt(req.params.id)))
})

app.delete('/api/vacancies/:id', auth, (req, res) => {
  db.prepare('DELETE FROM vacancies WHERE id=?').run(parseInt(req.params.id)); res.json({ message: 'Удалена' })
})

// Hiring Requests
app.get('/api/hiring-requests', auth, (req, res) => {
  const { role, id } = req.user
  const w = role === 'manager' ? `WHERE r.requested_by=${id}` : role === 'recruiter' ? `WHERE (r.assigned_recruiter_id=${id} OR r.assigned_recruiter_id IS NULL)` : ''
  res.json(db.prepare(`SELECT r.*,d.name as department_name,u1.name as requester_name,u2.name as recruiter_name FROM hiring_requests r LEFT JOIN departments d ON r.department_id=d.id LEFT JOIN users u1 ON r.requested_by=u1.id LEFT JOIN users u2 ON r.assigned_recruiter_id=u2.id ${w} ORDER BY r.created_at DESC`).all())
})

app.post('/api/hiring-requests', auth, (req, res) => {
  const b = req.body; const now = new Date().toISOString()
  const ins = db.prepare(`INSERT INTO hiring_requests (title,department_id,city,position,headcount,description,requirements,salary_range,priority,status,requested_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(b.title, b.department_id||null, b.city||null, b.position, b.headcount||1, b.description||null, b.requirements||null, b.salary_range||null, b.priority||'normal', 'pending', req.user.id, now, now)
  res.status(201).json(db.prepare('SELECT * FROM hiring_requests WHERE id=?').get(ins.lastInsertRowid))
})

app.put('/api/hiring-requests/:id', auth, (req, res) => {
  const b = req.body; const now = new Date().toISOString()
  if (b.status === 'approved') {
    const r2 = db.prepare('SELECT * FROM hiring_requests WHERE id=?').get(parseInt(req.params.id))
    if (r2 && !db.prepare('SELECT id FROM vacancies WHERE hiring_request_id=?').get(r2.id)) {
      db.prepare(`INSERT INTO vacancies (title,department_id,city,position,salary_range,description,requirements,status,hiring_request_id,recruiter_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(r2.title, r2.department_id, r2.city, r2.position, r2.salary_range, r2.description, r2.requirements, 'open', r2.id, b.assigned_recruiter_id||null, now, now)
    }
  }
  const fs2 = ['title','department_id','city','position','headcount','description','requirements','salary_range','priority','status','assigned_recruiter_id']
  const upd = fs2.filter(f => b[f] !== undefined)
  if (upd.length) db.prepare(`UPDATE hiring_requests SET ${upd.map(f=>f+'=?').join(',')},updated_at=? WHERE id=?`).run(...upd.map(f => b[f]), now, req.params.id)
  res.json(db.prepare('SELECT * FROM hiring_requests WHERE id=?').get(parseInt(req.params.id)))
})

app.delete('/api/hiring-requests/:id', auth, (req, res) => {
  db.prepare('DELETE FROM hiring_requests WHERE id=?').run(parseInt(req.params.id)); res.json({ message: 'Удалена' })
})

// Meetings
app.get('/api/meetings', auth, (req, res) => {
  const adm = req.user.role === 'admin'; const { upcoming } = req.query
  const conditions = []; const params = []
  if (!adm) { conditions.push('m.user_id = ?'); params.push(req.user.id) }
  if (upcoming === '1') { conditions.push('m.starts_at >= ?'); params.push(new Date().toISOString()) }
  const w = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  res.json(db.prepare(`SELECT m.*,c.full_name as candidate_name,u.name as user_name FROM meetings m LEFT JOIN candidates c ON m.candidate_id=c.id LEFT JOIN users u ON m.user_id=u.id ${w} ORDER BY m.starts_at ASC`).all(...params))
})

app.post('/api/meetings', auth, (req, res) => {
  const b = req.body; const now = new Date().toISOString()
  const ins = db.prepare(`INSERT INTO meetings (title,starts_at,duration_min,location,notes,candidate_id,user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(b.title, b.starts_at, b.duration_min||30, b.location||null, b.notes||null, b.candidate_id||null, req.user.id, now, now)
  res.status(201).json(db.prepare('SELECT * FROM meetings WHERE id=?').get(ins.lastInsertRowid))
})

app.put('/api/meetings/:id', auth, (req, res) => {
  const b = req.body; const now = new Date().toISOString()
  const upd = ['title','starts_at','duration_min','location','notes','candidate_id','done'].filter(f => b[f] !== undefined)
  if (upd.length) db.prepare(`UPDATE meetings SET ${upd.map(f=>f+'=?').join(',')},updated_at=? WHERE id=?`).run(...upd.map(f => b[f]), now, req.params.id)
  res.json(db.prepare('SELECT * FROM meetings WHERE id=?').get(parseInt(req.params.id)))
})

app.delete('/api/meetings/:id', auth, (req, res) => {
  db.prepare('DELETE FROM meetings WHERE id=?').run(parseInt(req.params.id)); res.json({ message: 'Удалена' })
})

// Analytics
app.get('/api/analytics', auth, (req, res) => {
  const stages = ['new','screening','phone','tech','final','offer','hired','rejected']
  const funnel = stages.map(s => ({ stage: s, count: db.prepare(`SELECT COUNT(*) as c FROM candidates WHERE stage=?`).get(s).c }))
  const bySource = db.prepare(`SELECT source,COUNT(*) as count FROM candidates WHERE source IS NOT NULL GROUP BY source ORDER BY count DESC LIMIT 10`).all()
  const byCity = db.prepare(`SELECT city,COUNT(*) as count FROM candidates WHERE city IS NOT NULL GROUP BY city ORDER BY count DESC LIMIT 10`).all()
  const total = db.prepare('SELECT COUNT(*) as c FROM candidates').get().c
  const hired = db.prepare(`SELECT COUNT(*) as c FROM candidates WHERE stage='hired'`).get().c
  const recruiters = db.prepare(`SELECT u.id,u.name,COUNT(c.id) as total,SUM(CASE WHEN c.stage='hired' THEN 1 ELSE 0 END) as hired,SUM(CASE WHEN c.stage='rejected' THEN 1 ELSE 0 END) as rejected FROM users u LEFT JOIN candidates c ON c.recruiter_id=u.id WHERE u.role='recruiter' GROUP BY u.id,u.name`).all().map(r => ({ ...r, conversion: r.total > 0 ? Math.round((r.hired / r.total) * 100) : 0 }))
  res.json({ funnel, by_source: bySource, by_city: byCity, recruiters, totals: { total, hired, conversion: total > 0 ? Math.round((hired / total) * 100) : 0 } })
})

// Users
app.get('/api/users', auth, (req, res) => {
  res.json(db.prepare(`SELECT u.id,u.name,u.email,u.role,u.position,u.phone,u.department_id,d.name as department_name,u.created_at FROM users u LEFT JOIN departments d ON u.department_id=d.id ORDER BY u.name`).all())
})

app.post('/api/users', auth, adminOnly, async (req, res) => {
  const { name, email, password, role = 'recruiter', position, phone, department_id } = req.body
  if (!name || !email || !password) return res.status(422).json({ message: 'name, email, password обязательны' })
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(422).json({ message: 'Email уже занят' })
  const now = new Date().toISOString(); const hashed = await bcrypt.hash(password, 10)
  const ins = db.prepare(`INSERT INTO users (name,email,password,role,position,phone,department_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(name, email, hashed, role, position||null, phone||null, department_id||null, now, now)
  const { password: _, ...u } = db.prepare('SELECT * FROM users WHERE id=?').get(ins.lastInsertRowid)
  res.status(201).json(u)
})

app.put('/api/users/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) return res.status(403).json({ message: 'Forbidden' })
  const b = req.body; const now = new Date().toISOString(); const upd = []; const vals = []
  for (const f of ['name','email','position','phone','department_id']) { if (b[f] !== undefined) { upd.push(f+'=?'); vals.push(b[f]) } }
  if (req.user.role === 'admin' && b.role) { upd.push('role=?'); vals.push(b.role) }
  if (b.password) { upd.push('password=?'); vals.push(await bcrypt.hash(b.password, 10)) }
  if (upd.length) db.prepare(`UPDATE users SET ${upd.join(',')},updated_at=? WHERE id=?`).run(...vals, now, req.params.id)
  const { password: _, ...u } = db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(req.params.id))
  res.json(u)
})

app.put('/api/profile', auth, async (req, res) => {
  const b = req.body; const now = new Date().toISOString(); const upd = []; const vals = []
  for (const f of ['name','email','position','phone']) { if (b[f] !== undefined) { upd.push(f+'=?'); vals.push(b[f]) } }
  if (b.password) { upd.push('password=?'); vals.push(await bcrypt.hash(b.password, 10)) }
  if (upd.length) db.prepare(`UPDATE users SET ${upd.join(',')},updated_at=? WHERE id=?`).run(...vals, now, req.user.id)
  const { password: _, ...u } = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)
  res.json(u)
})

app.delete('/api/users/:id', auth, adminOnly, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(422).json({ message: 'Нельзя удалить себя' })
  db.prepare('DELETE FROM users WHERE id=?').run(parseInt(req.params.id)); res.json({ message: 'Удалён' })
})

app.get('/api/departments', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM departments ORDER BY name').all())
})

app.get('/api/recruiters', auth, (req, res) => {
  res.json(db.prepare(`SELECT id, name FROM users WHERE role = 'recruiter' ORDER BY name`).all())
})

// Parse PDF — accepts { pdf_base64: string }, returns { text: string }
app.post('/api/parse-pdf', auth, async (req, res) => {
  try {
    const { pdf_base64 } = req.body
    if (!pdf_base64) return res.status(400).json({ error: 'pdf_base64 is required' })
    const buffer = Buffer.from(pdf_base64, 'base64')
    const data = await pdfParse(buffer)
    res.json({ text: data.text })
  } catch (err) {
    console.error('PDF parse error:', err.message)
    res.status(422).json({ error: 'Не удалось извлечь текст из PDF: ' + err.message })
  }
})

// ─── START ────────────────────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`RecruitFlow API running at http://127.0.0.1:${PORT}/api`)
    console.log(`DB: ${DB_PATH}`)
    console.log(`Login: admin@alinagroup.kz / password`)
  })
}).catch(err => { console.error('DB init failed:', err); process.exit(1) })
