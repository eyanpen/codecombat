const express = require('express')
const { getDb, ObjectId } = require('./database')

const router = express.Router()

// GET /user-data — returns JavaScript that sets window.userObject, window.serverConfig, and window.features
router.get('/', (req, res) => {
  res.set('Content-Type', 'application/javascript')

  const featuresJs = `window.features = ${JSON.stringify(getFeatures())};`
  const serverConfigJs = `window.serverConfig = ${JSON.stringify(getServerConfig())};`
  const stubsJs = 'window.StripeCheckout = { configure: function() { return { open: function(){}, on: function(){} }; } };'

  if (req.session && req.session.userId) {
    const db = getDb()
    db.collection('users').findOne({ _id: new ObjectId(req.session.userId) }).then(user => {
      if (user) {
        user._id = user._id.toString()
        return res.send(`window.userObject = ${JSON.stringify(user)}; ${serverConfigJs} ${featuresJs} ${stubsJs}`)
      }
      res.send(`window.userObject = ${JSON.stringify(anonymousUser())}; ${serverConfigJs} ${featuresJs} ${stubsJs}`)
    }).catch(() => {
      res.send(`window.userObject = ${JSON.stringify(anonymousUser())}; ${serverConfigJs} ${featuresJs} ${stubsJs}`)
    })
  } else {
    res.send(`window.userObject = ${JSON.stringify(anonymousUser())}; ${serverConfigJs} ${featuresJs} ${stubsJs}`)
  }
})

function anonymousUser () {
  const id = new ObjectId().toString()
  return {
    _id: id,
    anonymous: false,
    name: 'Guest Player',
    slug: 'guest-player',
    permissions: [],
    stripe: { free: true },
    emails: {},
    aceConfig: { language: 'python', keyBindings: 'default', invisibles: false, indentGuides: false, behaviors: true, liveCompletion: true },
    earned: { heroes: [], items: [], levels: [], gems: 0 },
    purchased: { heroes: [], items: [], levels: [], gems: 0 },
    preferredLanguage: 'en-US',
    testGroupNumber: Math.floor(Math.random() * 256),
    dateCreated: new Date().toISOString(),
    points: 0,
    volume: 0,
    music: false,
    activity: {},
  }
}

function getServerConfig () {
  return {
    codeNinjas: false,
    static: false,
    picoCTF: false,
    production: false,
    product: process.env.COCO_PRODUCT || 'codecombat',
  }
}

function getFeatures () {
  return {
    freeOnly: false,
  }
}

module.exports = router
