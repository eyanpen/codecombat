#!/usr/bin/env node
/**
 * Seed script: fetches campaign and level data from the public CodeCombat API
 * and imports it into the local MongoDB.
 *
 * Usage: node scripts/seed-data.js
 *
 * Fetches:
 *   - All campaigns (overworld map)
 *   - First dungeon campaign levels (playable starter content)
 */
const { MongoClient } = require('mongodb')
const https = require('https')

const MONGO_URL = process.env.COCO_MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = process.env.COCO_MONGO_DB || 'coco'
const SOURCE = 'https://codecombat.com'

function fetch (path) {
  return new Promise((resolve, reject) => {
    https.get(SOURCE + path, { headers: { Accept: 'application/json' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject)
      }
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(new Error(`Failed to parse response from ${path}: ${data.substring(0, 200)}`)) }
      })
    }).on('error', reject)
  })
}

async function main () {
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)
  console.log(`Connected to ${MONGO_URL}/${DB_NAME}`)

  // 1. Fetch campaigns
  console.log('Fetching campaigns...')
  let campaigns
  try {
    campaigns = await fetch('/db/campaign/-/overworld')
  } catch (e) {
    console.log('Overworld endpoint failed, trying individual campaign fetch...')
    campaigns = []
    for (const slug of ['dungeon', 'forest', 'desert']) {
      try {
        const c = await fetch(`/db/campaign/${slug}`)
        campaigns.push(c)
        console.log(`  Fetched campaign: ${slug}`)
      } catch (e2) {
        console.log(`  Failed to fetch ${slug}: ${e2.message}`)
      }
    }
  }

  if (campaigns.length === 0) {
    console.error('No campaigns fetched. The public API may be restricted.')
    console.log('\nAlternative: using minimal dungeon campaign seed data...')
    campaigns = [createMinimalDungeonCampaign()]
  }

  const campaignsCol = db.collection('campaigns')
  for (const campaign of campaigns) {
    const id = campaign._id || campaign.slug
    await campaignsCol.replaceOne({ _id: id }, { ...campaign, _id: id }, { upsert: true })
  }
  console.log(`Imported ${campaigns.length} campaigns`)

  // 2. Fetch levels from the first campaign
  const dungeonCampaign = campaigns.find(c => c.slug === 'dungeon') || campaigns[0]
  if (dungeonCampaign && dungeonCampaign.levels) {
    const levelSlugs = Object.values(dungeonCampaign.levels)
      .map(l => l.slug || l.name?.toLowerCase().replace(/\s+/g, '-'))
      .filter(Boolean)
      .slice(0, 20) // First 20 levels

    console.log(`Fetching ${levelSlugs.length} levels from "${dungeonCampaign.slug || 'first'}" campaign...`)
    const levelsCol = db.collection('levels')
    let imported = 0

    for (const slug of levelSlugs) {
      try {
        const level = await fetch(`/db/level/${slug}`)
        const id = level._id || slug
        await levelsCol.replaceOne({ _id: id }, { ...level, _id: id }, { upsert: true })
        imported++
        process.stdout.write(`  [${imported}/${levelSlugs.length}] ${slug}\n`)
      } catch (e) {
        console.log(`  SKIP ${slug}: ${e.message.substring(0, 80)}`)
      }
    }
    console.log(`Imported ${imported} levels`)
  }

  // 3. Seed a thang type (hero) so the play view has something
  console.log('Fetching hero thang types...')
  const thangsCol = db.collection('thang.types')
  for (const slug of ['captain', 'knight', 'champion', 'duelist']) {
    try {
      const thang = await fetch(`/db/thang.type/${slug}`)
      const id = thang._id || slug
      await thangsCol.replaceOne({ _id: id }, { ...thang, _id: id }, { upsert: true })
      console.log(`  Imported hero: ${slug}`)
    } catch (e) {
      console.log(`  SKIP hero ${slug}: ${e.message.substring(0, 60)}`)
    }
  }

  console.log('\nDone! Start the server with: COCO_PORT=3300 node index.js')
  await client.close()
}

function createMinimalDungeonCampaign () {
  return {
    _id: '55b29efd1cd6abe8ce07db0d',
    slug: 'dungeon',
    name: 'Kithgard Dungeon',
    fullName: 'Kithgard Dungeon',
    description: 'The first campaign - learn the basics of programming.',
    type: 'hero',
    color: '#5B2F09',
    adjacentCampaigns: {
      '55b29efd1cd6abe8ce07db0f': {
        slug: 'forest',
        name: 'Backwoods Forest',
        position: { x: 85, y: 30 },
      },
    },
    levels: {
      '5411cb3769152f1707be029c': {
        slug: 'dungeons-of-kithgard',
        name: 'Dungeons of Kithgard',
        original: '5411cb3769152f1707be029c',
        type: 'hero',
        requiresSubscription: false,
        position: { x: 14, y: 15.5 },
        nextLevels: { continue: '544fdecf86571e0200deb01a' },
      },
      '544fdecf86571e0200deb01a': {
        slug: 'gems-in-the-deep',
        name: 'Gems in the Deep',
        original: '544fdecf86571e0200deb01a',
        type: 'hero',
        requiresSubscription: false,
        position: { x: 20, y: 20 },
        nextLevels: { continue: '54eb10e886fc1e0200631e1b' },
      },
      '54eb10e886fc1e0200631e1b': {
        slug: 'shadow-guard',
        name: 'Shadow Guard',
        original: '54eb10e886fc1e0200631e1b',
        type: 'hero',
        requiresSubscription: false,
        position: { x: 26, y: 25 },
        nextLevels: { continue: '54f0e7e886fc1e0200631e27' },
      },
      '54f0e7e886fc1e0200631e27': {
        slug: 'forgetful-gemsmith',
        name: 'Forgetful Gemsmith',
        original: '54f0e7e886fc1e0200631e27',
        type: 'hero',
        requiresSubscription: false,
        position: { x: 32, y: 30 },
      },
    },
  }
}

main().catch(e => { console.error(e); process.exit(1) })
