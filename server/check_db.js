const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/mental_health';

async function checkDb() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    for (const coll of collections) {
      const count = await mongoose.connection.db.collection(coll.name).countDocuments();
      console.log(`Collection ${coll.name} has ${count} documents`);
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error checking DB:', err);
  }
}

checkDb();
