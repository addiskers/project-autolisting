import pymongo
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem
import hashlib
import json
from datetime import datetime, UTC

class DeltaMongoDBPipeline:
    
    def __init__(self, mongo_uri, mongo_db, mongo_collection):
        self.mongo_uri = mongo_uri
        self.mongo_db = mongo_db
        self.mongo_collection = mongo_collection
        self.changes_collection = f"{mongo_collection}_changes"
        
        self.session_stats = {
            'new_products': 0,
            'updated_products': 0,
            'unchanged_products': 0,
            'deleted_products': 0,
            'processed_products': 0
        }

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            mongo_uri=crawler.settings.get("MONGO_URI"),
            mongo_db=crawler.settings.get("MONGO_DATABASE"),
            mongo_collection=crawler.settings.get("MONGO_COLLECTION"),
        )

    def open_spider(self, spider):
        try:
            self.client = pymongo.MongoClient(self.mongo_uri)
            self.db = self.client[self.mongo_db]
            self.collection = self.db[self.mongo_collection]
            self.changes_collection_db = self.db[self.changes_collection]
            
            self.session_id = datetime.now().strftime('%Y%m%d_%H%M%S')
            spider.session_id = self.session_id
            
            mark_result = self.collection.update_many(
                {"status_flag": {"$ne": "DELETED"}},
                {"$set": {"seen_in_session": False}}
            )
            
            spider.logger.info(f"Starting session: {self.session_id}")
            spider.logger.debug(f"Connected to MongoDB: {self.mongo_uri}/{self.mongo_db}")
            spider.logger.debug(f"Marked {mark_result.modified_count} products for deletion detection")
            
        except Exception as e:
            spider.logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    def close_spider(self, spider):
        deleted_products = self.collection.find({
            "seen_in_session": False,
            "status_flag": {"$ne": "DELETED"}
        })
        
        deleted_count = 0
        for product in deleted_products:
            self.collection.update_one(
                {"_id": product["_id"]},
                {
                    "$set": {
                        "status_flag": "DELETED",
                        "deleted_at": datetime.now(UTC),
                        "last_seen_session": product.get('last_seen_session', 'unknown')
                    }
                }
            )
            
            self._log_change(product, 'DELETED', {}, spider)
            deleted_count += 1
            spider.logger.debug(f"DELETED: {product.get('title', 'Unknown')}")
        
        self.session_stats['deleted_products'] = deleted_count
        
        self.collection.update_many({}, {"$unset": {"seen_in_session": ""}})
        
        stats = self.session_stats
        spider.logger.info(f"Session {self.session_id} completed:")
        spider.logger.info(f"New: {stats['new_products']}, Updated: {stats['updated_products']}, Unchanged: {stats['unchanged_products']}, Deleted: {stats['deleted_products']}")
        
        self.save_session_summary(spider)
        self.client.close()

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        
        if not self._is_valid_product(adapter):
            return item
        
        try:
            current_item = self._prepare_item(adapter)
            content_hash = self._generate_content_hash(current_item)
            existing = self._find_existing_product(current_item)
            
            if existing is None:
                result = self._handle_new_product(current_item, content_hash, spider)
            elif existing.get('content_hash') != content_hash:
                result = self._handle_updated_product(existing, current_item, content_hash, spider)
            else:
                result = self._handle_unchanged_product(existing, spider)
            
            self.session_stats['processed_products'] += 1
            return item
            
        except Exception as e:
            spider.logger.error(f"Error processing item: {e}")
            raise DropItem(f"Processing error: {e}")

    def _is_valid_product(self, adapter):
        return (adapter.get("title") and 
                adapter.get("url") and 
                adapter.get("title").strip())

    def _prepare_item(self, adapter):
        item = adapter.asdict()
        
        item['scraped_at'] = datetime.now(UTC)
        item['manufacturer'] = 'Phoenix Tapware'
        item['seen_in_session'] = True
        item['last_seen_session'] = self.session_id
        
        cleaned = {}
        for key, value in item.items():
            if value is not None and value != []:
                cleaned[key] = value
        
        return cleaned

    def _generate_content_hash(self, item):
        content_fields = [
            'title', 'description', 'features', 'main_color', 'colors',
            'pressure_rating', 'temperature_rating', 'warranty',
            'wels_rating', 'flow_rate', 'status', 
        ]
        
        content_data = {}
        for field in content_fields:
            if field in item:
                content_data[field] = item[field]
        
        content_str = json.dumps(content_data, sort_keys=True, default=str)
        return hashlib.md5(content_str.encode()).hexdigest()

    def _find_existing_product(self, item):
        query = {}
        if item.get('sku'):
            query['sku'] = item['sku']
        else:
            query['url'] = item['url']
        return self.collection.find_one(query)

    def _handle_new_product(self, item, content_hash, spider):
        item['content_hash'] = content_hash
        item['first_seen'] = datetime.now(UTC)
        item['last_updated'] = datetime.now(UTC)
        item['status_flag'] = 'NEW'
        item['needs_processing'] = True
        
        result = self.collection.insert_one(item)
        
        self.session_stats['new_products'] += 1
        spider.logger.info(f"NEW: {item.get('title', 'Unknown')} (SKU: {item.get('sku', 'N/A')})")
        
        self._log_change(item, 'NEW', {}, spider)
        return result

    def _handle_updated_product(self, existing, current_item, content_hash, spider):
        changes = self._detect_changes(existing, current_item)
        
        current_item['content_hash'] = content_hash
        current_item['last_updated'] = datetime.now(UTC)
        current_item['first_seen'] = existing.get('first_seen', datetime.now(UTC))
        current_item['status_flag'] = 'UPDATED'
        current_item['needs_processing'] = True
        
        result = self.collection.update_one(
            {'_id': existing['_id']},
            {'$set': current_item}
        )
        
        self.session_stats['updated_products'] += 1
        change_summary = ', '.join(changes.keys())
        spider.logger.info(f"UPDATED: {current_item.get('title', 'Unknown')} - Changes: {change_summary}")
        
        self._log_change(current_item, 'UPDATED', changes, spider)
        return result

    def _handle_unchanged_product(self, existing, spider):
        self.collection.update_one(
            {'_id': existing['_id']},
            {
                '$set': {
                    'seen_in_session': True,
                    'last_seen_session': self.session_id,
                    'last_seen': datetime.now(UTC),
                    'status_flag': 'UNCHANGED',
                    'needs_processing': False
                }
            }
        )
        
        self.session_stats['unchanged_products'] += 1
        spider.logger.debug(f"UNCHANGED: {existing.get('title', 'Unknown')}")
        return None

    def _detect_changes(self, old_item, new_item):
        changes = {}
        
        tracked_fields = [
            'title', 'description', 'features', 'main_color', 'colors',
            'pressure_rating', 'temperature_rating', 'warranty',
            'wels_rating', 'flow_rate', 'status', 'images'
        ]
        
        for field in tracked_fields:
            old_value = old_item.get(field)
            new_value = new_item.get(field)
            
            if old_value != new_value:
                changes[field] = {
                    'old': old_value,
                    'new': new_value
                }
        
        return changes

    def _log_change(self, item, change_type, changes, spider):
        if change_type == 'UNCHANGED':
            return
            
        change_record = {
            'session_id': self.session_id,
            'product_id': item.get('sku') or item.get('url'),
            'product_title': item.get('title'),
            'change_type': change_type,
            'changes': changes,
            'timestamp': datetime.now(UTC),
            'needs_user_review': self._needs_user_review(change_type, changes)
        }
        
        self.changes_collection_db.insert_one(change_record)

    def _needs_user_review(self, change_type, changes):
        if change_type == 'NEW':
            return True
        elif change_type == 'DELETED':
            return True
        elif change_type == 'UPDATED':
            major_change_fields = ['title', 'status', 'wels_rating']
            return any(field in changes for field in major_change_fields)
        return False

    def save_session_summary(self, spider):
        summary = {
            'session_id': self.session_id,
            'session_date': datetime.now(UTC),
            'manufacturer': 'Phoenix',
            'stats': self.session_stats,
            'spider_name': spider.name
        }
        
        self.db['scrape_sessions'].insert_one(summary)


class ProductProcessor:
    
    def __init__(self, mongo_uri, mongo_db, collection_name):
        self.client = pymongo.MongoClient(mongo_uri)
        self.db = self.client[mongo_db]
        self.collection = self.db[collection_name]
    
    def process_pending_products(self):
        pending_products = self.collection.find({
            'needs_processing': True,
            'status_flag': {'$in': ['NEW', 'UPDATED']}
        })
        
        processed_count = 0
        for product in pending_products:
            try:
                processed_data = self._process_product_content(product)
                
                self.collection.update_one(
                    {'_id': product['_id']},
                    {
                        '$set': {
                            'processed_content': processed_data,
                            'needs_processing': False,
                            'processed_at': datetime.now(UTC),
                            'status_flag': 'PROCESSED'
                        }
                    }
                )
                
                processed_count += 1
                print(f"Processed: {product.get('title', 'Unknown')}")
                
            except Exception as e:
                print(f"Error processing {product.get('title', 'Unknown')}: {e}")
                
                self.collection.update_one(
                    {'_id': product['_id']},
                    {
                        '$set': {
                            'processing_error': str(e),
                            'needs_user_review': True
                        }
                    }
                )
        
        print(f"Processing complete. Processed {processed_count} products")
        return processed_count
    
    def _process_product_content(self, product):
        processed = {
            'enhanced_title': product.get('title', ''),
            'enhanced_description': product.get('description', ''),
            'seo_tags': self._generate_tags(product),
            'processed_at': datetime.now(UTC)
        }
        return processed
    
    def _generate_tags(self, product):
        tags = []
        if product.get('category'):
            tags.append(product['category'].lower())
        if product.get('main_color'):
            tags.append(product['main_color'].lower())
        if product.get('wels_rating'):
            tags.append('water-efficient')
        return tags

    def get_changes_summary(self, session_id=None):
        query = {}
        if session_id:
            query['session_id'] = session_id
        
        pipeline = [
            {"$match": query},
            {"$group": {
                "_id": "$change_type",
                "count": {"$sum": 1}
            }}
        ]
        
        results = list(self.db[f'{self.collection.name}_changes'].aggregate(pipeline))
        
        summary = {
            'NEW': 0,
            'UPDATED': 0, 
            'DELETED': 0
        }
        
        for result in results:
            summary[result['_id']] = result['count']
        
        return summary