const { MongoClient, ObjectId } = require('mongodb')

const MONGO_URL = process.env.COCO_MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = process.env.COCO_MONGO_DB || 'coco'

let db = null
let client = null

async function connect () {
  if (db) return db
  client = new MongoClient(MONGO_URL)
  await client.connect()
  db = client.db(DB_NAME)
  console.info(`Connected to MongoDB: ${MONGO_URL}/${DB_NAME}`)
  return db
}

function getDb () {
  return db
}

function toObjectId (id) {
  if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
    return new ObjectId(id)
  }
  return id
}

module.exports = { connect, getDb, toObjectId, ObjectId }
