import pymongo
from .config import settings

client = pymongo.MongoClient(settings.MONGO_URI)
db = client[settings.MONGO_DATABASE]
collection = db[settings.MONGO_COLLECTION]

def get_database():
    """Get database instance"""
    return db

def get_collection():
    """Get main products collection"""
    return collection

def get_mongo_client():
    """Get MongoDB client"""
    return client