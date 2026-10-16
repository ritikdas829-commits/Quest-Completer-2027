// Compatibility shim - roleStore.js mongo.js dhoondhta hai
export * from './db.js';
export { default } from './db.js';
export { getDatabase, getCollection, isMongoReady, connectDB } from './db.js';
