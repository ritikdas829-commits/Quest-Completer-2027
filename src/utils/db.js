import mongoose from 'mongoose';

export async function connectDB() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error('❌ MONGODB_URI is missing in .env file');
            return;
        }
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB successfully!');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
    }
}
