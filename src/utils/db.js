import mongoose from 'mongoose';

export async function connectDB() {
    try {
        // Yeh dono me se jo bhi mil jaye use kar lega
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) {
            console.error('❌ MONGO_URI or MONGODB_URI is missing in environment variables.');
            return;
        }
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB successfully!');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
    }
}
