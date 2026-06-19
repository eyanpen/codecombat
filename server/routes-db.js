const express = require('express')
const { getDb, toObjectId, ObjectId } = require('./database')

const router = express.Router()

// Map URL collection names to MongoDB collection names
const COLLECTION_MAP = {
  user: 'users',
  level: 'levels',
  'level.session': 'level.sessions',
  'level.component': 'level.components',
  'level.system': 'level.systems',
  'level.feedback': 'level.feedbacks',
  'thang.type': 'thang.types',
  campaign: 'campaigns',
  achievement: 'achievements',
  earned_achievement: 'earned.achievements',
  course: 'courses',
  course_instance: 'course.instances',
  classroom: 'classrooms',
  prepaid: 'prepaids',
  clan: 'clans',
  poll: 'polls',
  patch: 'patches',
  article: 'articles',
  mandate: 'mandates',
  products: 'products',
  file: 'media.files',
  ai_scenario: 'ai.scenarios',
  ai_project: 'ai.projects',
  ai_document: 'ai.documents',
  ai_model: 'ai.models',
  ai_chat_message: 'ai.chat.messages',
  ai_junior_project: 'ai.junior.projects',
  ai_junior_scenario: 'ai.junior.scenarios',
  announcement: 'announcements',
  chat_message: 'chat.messages',
  tournament: 'tournaments',
  'tournament.match': 'tournament.matches',
  'tournament.submission': 'tournament.submissions',
  'trial.request': 'trial.requests',
  payment: 'payments',
  purchase: 'purchases',
  podcast: 'podcasts',
  'user.polls.record': 'user.polls.records',
  'user.code.problem': 'user.code.problems',
  concept: 'concepts',
  codelogs: 'codelogs',
  branches: 'branches',
  resource_hub_resource: 'resource.hub.resources',
  standards: 'standards',
  oauth2identity: 'oauth2identities',
  'skipped-contact': 'skipped.contacts',
  'interactive.session': 'interactive.sessions',
}

function getCollection (urlName) {
  const mongoName = COLLECTION_MAP[urlName] || urlName
  return getDb().collection(mongoName)
}

// GET /db/:collection/names — batch lookup by ids
router.get('/:collection/names', async (req, res) => {
  try {
    const col = getCollection(req.params.collection)
    const ids = req.query.ids || req.query['ids[]'] || []
    const idList = Array.isArray(ids) ? ids : [ids]
    const query = {
      $or: [
        { original: { $in: idList } },
        { _id: { $in: idList } },
      ],
    }
    const docs = await col.find(query).toArray()
    // Return as object keyed by original
    const result = {}
    docs.forEach(d => { result[d.original || d._id] = d })
    res.json(result)
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// GET /db/:collection — list/query
router.get('/:collection', async (req, res) => {
  try {
    const col = getCollection(req.params.collection)
    const query = {}
    const options = { limit: 100 }

    // Support ?project=field1,field2
    if (req.query.project) {
      options.projection = {}
      req.query.project.split(',').forEach(f => { options.projection[f.trim()] = 1 })
    }
    if (req.query.limit) {
      options.limit = Math.min(parseInt(req.query.limit) || 100, 1000)
    }
    if (req.query.skip) {
      options.skip = parseInt(req.query.skip) || 0
    }

    // Support simple equality filters from query params
    const reserved = ['project', 'limit', 'skip', 'sort', 'view']
    if (req.query.view === 'heroes' && req.params.collection === 'thang.type') {
      query.heroClass = { $exists: true }
    }
    for (const [k, v] of Object.entries(req.query)) {
      if (!reserved.includes(k)) {
        query[k] = v
      }
    }

    const docs = await col.find(query, options).toArray()
    res.json(docs)
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// GET /db/:collection/:idOrSlug
router.get('/:collection/:id', async (req, res) => {
  try {
    const col = getCollection(req.params.collection)
    const id = req.params.id
    let doc

    if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
      doc = await col.findOne({ _id: new ObjectId(id) })
    } else {
      // Try slug lookup
      doc = await col.findOne({ slug: id }) || await col.findOne({ name: id })
    }

    if (!doc) return res.status(404).json({ message: 'Not found' })
    res.json(doc)
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// GET /db/:collection/:id/:subpath (version, patches, etc.)
router.get('/:collection/:id/:subpath', async (req, res) => {
  try {
    const col = getCollection(req.params.collection)
    const id = req.params.id
    const subpath = req.params.subpath

    if (subpath === 'version') {
      // Try by original field first (string or ObjectId), then by _id
      let doc = await col.findOne({ original: id })
      if (!doc) {
        doc = await col.findOne(
          { original: toObjectId(id) },
          { sort: { 'version.major': -1, 'version.minor': -1 } },
        )
      }
      if (!doc) {
        const oid = ObjectId.isValid(id) && String(new ObjectId(id)) === id ? new ObjectId(id) : id
        doc = await col.findOne({ _id: oid })
      }
      if (!doc) return res.status(404).json({ message: 'Not found' })
      return res.json(doc)
    }

    // Default: return empty array for sub-resource queries
    res.json([])
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// POST /db/:collection
router.post('/:collection', async (req, res) => {
  try {
    const col = getCollection(req.params.collection)
    const doc = req.body
    if (!doc._id) doc._id = new ObjectId()
    await col.insertOne(doc)
    res.status(201).json(doc)
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// PUT /db/:collection/:id
router.put('/:collection/:id', async (req, res) => {
  try {
    const col = getCollection(req.params.collection)
    const id = req.params.id
    const update = req.body
    delete update._id

    const filter = ObjectId.isValid(id) && String(new ObjectId(id)) === id
      ? { _id: new ObjectId(id) }
      : { slug: id }

    const result = await col.findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after', upsert: true })
    res.json(result.value || result)
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// PATCH /db/:collection/:id (same as PUT for simplicity)
router.patch('/:collection/:id', async (req, res) => {
  try {
    const col = getCollection(req.params.collection)
    const id = req.params.id
    const update = req.body
    delete update._id

    const filter = ObjectId.isValid(id) && String(new ObjectId(id)) === id
      ? { _id: new ObjectId(id) }
      : { _id: id }

    const result = await col.findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after', upsert: true })
    const doc = result.value || result
    res.json(doc._id ? doc : { _id: id, ...update })
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// POST /db/:collection/:id/:action (sub-actions)
router.post('/:collection/:id/:action', async (req, res) => {
  res.json({ success: true })
})

// POST /db/:collection/:id/:action/:subaction (e.g. track/visit/1)
router.post('/:collection/:id/:action/:subaction', async (req, res) => {
  res.json({ success: true })
})

// POST /db/:collection/:id/:a/:b/:c
router.post('/:collection/:id/:a/:b/:c', async (req, res) => {
  res.json({ success: true })
})

// PUT /db/:collection/:id/:action (e.g. extra-provisions)
router.put('/:collection/:id/:action', async (req, res) => {
  res.json({ success: true })
})

module.exports = router
