import { getDatabase, getCollection, isMongoReady } from './db.js';

export { getDatabase, getCollection, isMongoReady };
export const connectDB = getDatabase;
export default getDatabase;
export const getMongoClient = () => null;
