import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId

class FetchStatus:
    def __init__(self, mongo_client):
        self.client = mongo_client
        db_name = os.getenv("MONGO_DATABASE", "phoenix_products")
        self.db = self.client[db_name]
        self.collection = self.db["fetch"]
        self.listing_collection = self.db["listing_history"]
    
    def save_fetch_start(self, fetch_type: str, vendor: str, status: str = "running"):
        doc = {
            "type": fetch_type, 
            "name": vendor,
            "status": status,
            "started_at": datetime.now(),
            "updated_at": datetime.now()
        }        
        result = self.collection.insert_one(doc)
        print(f"Started {fetch_type} for {vendor} (ID: {result.inserted_id})")
        return result.inserted_id 
    
    def save_fetch_complete(self, fetch_type: str, vendor: str, success: bool = True, error: str = None, doc_id: str = None):
        update_doc = {
            "status": "completed" if success else "error",
            "completed_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        if error:
            update_doc["error"] = error
        
        if doc_id:
            query = {"_id": ObjectId(doc_id)}
        else:
            query = {
                "type": fetch_type, 
                "name": vendor, 
                "status": "running"
            }
        
        result = self.collection.update_one(
            query,
            {"$set": update_doc}
        )
        
        if result.matched_count > 0:
            print(f"Completed {fetch_type} for {vendor}: {'success' if success else 'error'}")
        else:
            print(f"Warning: Could not find running {fetch_type} for {vendor} to complete")
    
    def get_fetch_status(self, fetch_type: str, vendor: str):
        return self.collection.find_one(
            {"type": fetch_type, "name": vendor},
            sort=[("updated_at", -1)]
        )
    
    def is_fetch_active(self, fetch_type: str, vendor: str) -> bool:
        status_doc = self.get_fetch_status(fetch_type, vendor)
        if not status_doc:
            return False
        
        if status_doc.get("status") == "running":
            started_at = status_doc.get("started_at")
            if started_at:
                time_diff = datetime.now() - started_at
                return time_diff.total_seconds() < 600
        
        return False
    
    def get_last_fetch_date(self, fetch_type: str, vendor: str):
        status_doc = self.collection.find_one(
            {"type": fetch_type, "name": vendor, "status": "completed"},
            sort=[("completed_at", -1)]
        )
        
        if status_doc and status_doc.get("completed_at"):
            return status_doc["completed_at"]
        
        return None
    
    def save_listing_operation(self, operation_type: str, vendor: str, sku_data: List[Dict], success_count: int, failed_count: int, results: List[Dict] = None):
        doc = {
            "operation_type": operation_type,
            "vendor": vendor,
            "sku_data": sku_data,
            "total_requested": len(sku_data),
            "successful_listings": success_count,
            "failed_listings": failed_count,
            "success_rate": f"{(success_count / len(sku_data) * 100):.1f}%" if sku_data else "0%",
            "results": results or [],
            "timestamp": datetime.now(),
            "created_at": datetime.now()
        }
        
        result = self.listing_collection.insert_one(doc)
        print(f"Saved listing operation: {operation_type} for {vendor} - {success_count}/{len(sku_data)} successful")
        return str(result.inserted_id)
    
    def get_listing_history(self, page: int = 1, limit: int = 50, vendor_filter: str = None, operation_filter: str = None):
        query = {}
        if vendor_filter:
            query["vendor"] = {"$regex": vendor_filter, "$options": "i"}
        if operation_filter:
            query["operation_type"] = operation_filter
        
        total = self.listing_collection.count_documents(query)
        
        skip = (page - 1) * limit
        cursor = self.listing_collection.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        
        history = []
        for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            
            if doc.get("timestamp"):
                doc["timestamp"] = doc["timestamp"].isoformat()
            if doc.get("created_at"):
                doc["created_at"] = doc["created_at"].isoformat()
            
            history.append(doc)
        
        return {
            "history": history,
            "total": total,
            "page": page,
            "limit": limit,
            "has_next": skip + limit < total,
            "has_prev": page > 1
        }
    
    def get_listing_stats(self):
        pipeline = [
            {
                "$group": {
                    "_id": "$vendor",
                    "total_operations": {"$sum": 1},
                    "total_products_attempted": {"$sum": "$total_requested"},
                    "total_successful": {"$sum": "$successful_listings"},
                    "total_failed": {"$sum": "$failed_listings"},
                    "last_operation": {"$max": "$timestamp"}
                }
            },
            {"$sort": {"total_operations": -1}}
        ]
        
        vendor_stats = list(self.listing_collection.aggregate(pipeline))
        
        total_operations = self.listing_collection.count_documents({})
        total_today = self.listing_collection.count_documents({
            "timestamp": {
                "$gte": datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            }
        })
        
        total_successful_pipeline = [
            {"$group": {"_id": None, "total": {"$sum": "$successful_listings"}}}
        ]
        total_successful_result = list(self.listing_collection.aggregate(total_successful_pipeline))
        total_successful = total_successful_result[0]["total"] if total_successful_result else 0
        
        return {
            "total_operations": total_operations,
            "total_successful_listings": total_successful,
            "operations_today": total_today,
            "vendor_breakdown": vendor_stats
        }