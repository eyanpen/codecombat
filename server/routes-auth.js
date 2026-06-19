const express = require('express')
const crypto = require('crypto')
const { getDb, ObjectId } = require('./database')

const router = express.Router()

function createAnonymousUser () {
  return {
    _id: new ObjectId().toString(),
    anonymous: false,
    name: 'Guest Player',
    slug: 'guest-player',
    permissions: [],
    email: '',
    emails: {},
    stripe: { free: true },
    aceConfig: { language: 'python', keyBindings: 'default', invisibles: false, indentGuides: false, behaviors: true, liveCompletion: true },
    earned: { heroes: [], items: [], levels: [], gems: 0 },
    purchased: { heroes: [], items: [], levels: [], gems: 0 },
    stats: { gamesCompleted: 0 },
    preferredLanguage: 'en-US',
    testGroupNumber: Math.floor(Math.random() * 256),
    dateCreated: new Date().toISOString(),
    points: 0,
    volume: 1,
    music: true,
    activity: {},
  }
}

// GET /auth/whoami
router.get('/whoami', (req, res) => {
  if (req.session && req.session.userId) {
    const db = getDb()
    db.collection('users').findOne({ _id: new ObjectId(req.session.userId) }).then(user => {
      if (user) {
        user._id = user._id.toString()
        return res.json(user)
      }
      res.json(createAnonymousUser())
    }).catch(() => res.json(createAnonymousUser()))
  } else {
    res.json(createAnonymousUser())
  }
})

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body
  const db = getDb()
  const user = await db.collection('users').findOne({
    $or: [{ email: username }, { name: username }],
  })
  if (!user) return res.status(401).json({ message: 'Invalid credentials' })

  const hash = crypto.createHash('sha256').update(password + (user.salt || '')).digest('hex')
  if (hash !== user.passwordHash) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  req.session.userId = user._id.toString()
  user._id = user._id.toString()
  res.json(user)
})

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session = null
  res.json({ success: true })
})

// POST /auth/reset
router.post('/reset', (req, res) => {
  res.json({ success: true })
})

// POST /auth/name/:name — check name availability
router.get('/name/:name', async (req, res) => {
  const db = getDb()
  const existing = await db.collection('users').findOne({ slug: req.params.name.toLowerCase() })
  res.json({ slug: req.params.name.toLowerCase(), conflicts: !!existing })
})

// POST /auth/email/:email — check email availability
router.get('/email/:email', async (req, res) => {
  const db = getDb()
  const existing = await db.collection('users').findOne({ email: req.params.email })
  res.json({ exists: !!existing })
})

module.exports = router
