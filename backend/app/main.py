from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pymongo
import subprocess
import os
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
import json
import requests
import tempfile
from urllib.parse import urlparse
import time
from datetime import datetime
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv()

# Pydantic models
class BulkListRequest(BaseModel):
    skus: List[str]

class ShopifyFetchRequest(BaseModel):
    vendor: str

# Shopify Fetch Service Class
class ShopifyFetchService:
    def __init__(self):
        """Initialize the Shopify fetch service with environment variables"""
        self.shopify_url = os.getenv("SHOPIFY_GRAPHQL_URL")
        self.access_token = os.getenv("SHOPIFY_ACCESS_TOKEN")
        
        if not self.shopify_url or not self.access_token:
            raise ValueError("Missing Shopify credentials in environment variables")
            
        self.headers = {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": self.access_token,
        }

        # MongoDB connection using environment variables
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.mongo_client = pymongo.MongoClient(mongo_uri)

    def fetch_shopify_products(self, cursor=None, vendor="SYDPEK"):
        """Fetch products from Shopify GraphQL API"""
        # Build the query with or without cursor for pagination
        if cursor:
            query = f"""{{
                products(first: 250, query: "vendor:{vendor}", after: "{cursor}") {{
                    pageInfo {{
                        hasNextPage
                        hasPreviousPage
                        startCursor
                        endCursor
                    }}
                    edges {{
                        cursor
                        node {{
                            id
                            title
                            description
                            handle
                            status
                            createdAt
                            updatedAt
                            publishedAt
                            productType
                            vendor
                            tags
                            totalInventory
                            totalVariants
                            onlineStoreUrl
                            onlineStorePreviewUrl
                            templateSuffix
                            legacyResourceId
                            requiresSellingPlan
                            isGiftCard
                            images(first: 10) {{
                                edges {{
                                    node {{
                                        id
                                        url
                                        altText
                                        width
                                        height
                                    }}
                                }}
                            }}
                            variants(first: 10) {{
                                edges {{
                                    node {{
                                        id
                                        title
                                        price
                                        compareAtPrice
                                        sku
                                        barcode
                                        taxable
                                        availableForSale
                                        inventoryQuantity
                                        inventoryPolicy
                                        image {{
                                            id
                                            url
                                            altText
                                        }}
                                        selectedOptions {{
                                            name
                                            value
                                        }}
                                    }}
                                }}
                            }}
                            options {{
                                id
                                name
                                values
                                position
                            }}
                            seo {{
                                title
                                description
                            }}
                            metafields(first: 10) {{
                                edges {{
                                    node {{
                                        id
                                        namespace
                                        key
                                        value
                                        type
                                    }}
                                }}
                            }}
                        }}
                    }}
                }}
            }}"""
        else:
            query = f"""{{
                products(first: 250, query: "vendor:{vendor}") {{
                    pageInfo {{
                        hasNextPage
                        hasPreviousPage
                        startCursor
                        endCursor
                    }}
                    edges {{
                        cursor
                        node {{
                            id
                            title
                            description
                            handle
                            status
                            createdAt
                            updatedAt
                            publishedAt
                            productType
                            vendor
                            tags
                            totalInventory
                            totalVariants
                            onlineStoreUrl
                            onlineStorePreviewUrl
                            templateSuffix
                            legacyResourceId
                            requiresSellingPlan
                            isGiftCard
                            images(first: 10) {{
                                edges {{
                                    node {{
                                        id
                                        url
                                        altText
                                        width
                                        height
                                    }}
                                }}
                            }}
                            variants(first: 10) {{
                                edges {{
                                    node {{
                                        id
                                        title
                                        price
                                        compareAtPrice
                                        sku
                                        barcode
                                        taxable
                                        availableForSale
                                        inventoryQuantity
                                        inventoryPolicy
                                        image {{
                                            id
                                            url
                                            altText
                                        }}
                                        selectedOptions {{
                                            name
                                            value
                                        }}
                                    }}
                                }}
                            }}
                            options {{
                                id
                                name
                                values
                                position
                            }}
                            seo {{
                                title
                                description
                            }}
                            metafields(first: 10) {{
                                edges {{
                                    node {{
                                        id
                                        namespace
                                        key
                                        value
                                        type
                                    }}
                                }}
                            }}
                        }}
                    }}
                }}
            }}"""

        payload = {"query": query}

        try:
            response = requests.post(self.shopify_url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching data from Shopify: {e}")
            return None

    def store_products_in_mongodb(self, products_data, collection):
        """Store individual products in MongoDB"""
        if not products_data or "data" not in products_data:
            print("No valid product data to store")
            return 0

        products = products_data["data"]["products"]["edges"]
        stored_count = 0

        for product_edge in products:
            try:
                # Get the product node (the actual product data)
                product = product_edge["node"]

                # Add metadata for tracking
                product["_imported_at"] = datetime.now()
                product["_source"] = "shopify_graphql"

                # Insert individual product into MongoDB
                result = collection.insert_one(product)
                if result.inserted_id is not None:
                    stored_count += 1
                    print(f"Stored product: {product['title']} (ID: {product['id']})")

            except Exception as e:
                print(f"Error storing product {product.get('title', 'Unknown')}: {e}")
                continue

        return stored_count

    def sync_all_shopify_products(self, vendor, website_name):
        """Main function to sync all products from Shopify to MongoDB"""
        # Get database and collection
        db_name = os.getenv("MONGO_DATABASE", "phoenix_products")
        db = self.mongo_client[db_name]
        collection_name = f"auspek_{website_name}"
        collection = db[collection_name]

        # Delete existing collection
        try:
            collection.drop()
            print(f"Dropped existing collection: {collection_name}")
        except Exception as e:
            print(f"Error dropping collection (may not exist): {e}")

        print(f"Starting sync for vendor: {vendor} to collection: {collection_name}")
        total_products = 0
        cursor = None
        page_number = 1

        while True:
            print(f"Fetching page {page_number}...")

            # Fetch products from Shopify
            response_data = self.fetch_shopify_products(cursor, vendor)

            if not response_data:
                print("Failed to fetch data from Shopify")
                break

            # Check for errors in response
            if "errors" in response_data:
                print(f"GraphQL errors: {response_data['errors']}")
                break

            # Store products in MongoDB
            stored_count = self.store_products_in_mongodb(response_data, collection)
            total_products += stored_count

            # Check pagination
            page_info = response_data["data"]["products"]["pageInfo"]
            has_next_page = page_info.get("hasNextPage", False)

            print(f"Page {page_number}: Stored {stored_count} products")

            if not has_next_page:
                print("No more pages to fetch")
                break

            # Get cursor for next page
            cursor = page_info.get("endCursor")
            if not cursor:
                print("No cursor for next page")
                break

            page_number += 1
            
            # Add small delay to be respectful to Shopify API
            time.sleep(0.5)

        print(f"Sync completed! Total products stored: {total_products}")
        return total_products

    def close_connection(self):
        """Close MongoDB connection"""
        if hasattr(self, 'mongo_client'):
            self.mongo_client.close()

# Shopify Sync Service Class (existing code)
class ShopifySyncService:
    def __init__(self):
        """Initialize the Shopify sync service with environment variables"""
        self.shopify_url = os.getenv("SHOPIFY_GRAPHQL_URL")
        self.access_token = os.getenv("SHOPIFY_ACCESS_TOKEN")
        
        if not self.shopify_url or not self.access_token:
            raise ValueError("Missing Shopify credentials in environment variables")
            
        self.headers = {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": self.access_token,
        }

        # MongoDB connection using environment variables
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        db_name = os.getenv("MONGO_DATABASE", "phoenix_products")
        collection_name = os.getenv("MONGO_COLLECTION", "products")
        
        self.mongo_client = pymongo.MongoClient(mongo_uri)
        self.db = self.mongo_client[db_name]
        self.collection = self.db[collection_name]

    def download_image_from_url(self, image_url: str) -> tuple[str, str]:
        """Download image from URL with retry logic"""
        try:
            print(f"⬇️  Downloading image: {image_url}")

            user_agents = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            ]

            response = None
            for i, user_agent in enumerate(user_agents):
                try:
                    headers = {
                        "User-Agent": user_agent,
                        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
                    }

                    if i > 0:
                        time.sleep(2)

                    response = requests.get(
                        image_url,
                        stream=True,
                        timeout=30,
                        headers=headers,
                        allow_redirects=True,
                    )
                    response.raise_for_status()
                    break

                except requests.exceptions.HTTPError as e:
                    if e.response.status_code == 403 and i < len(user_agents) - 1:
                        continue
                    else:
                        raise
                except requests.exceptions.RequestException:
                    if i < len(user_agents) - 1:
                        continue
                    else:
                        raise

            # Get filename from URL
            parsed_url = urlparse(image_url)
            filename = os.path.basename(parsed_url.path)
            if not filename or "." not in filename:
                filename = f"image_{int(time.time())}.jpg"

            # Create temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}")

            # Download file content
            total_size = 0
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    temp_file.write(chunk)
                    total_size += len(chunk)

            temp_file.close()
            print(f"✅ Downloaded {total_size} bytes")
            return temp_file.name, filename

        except Exception as e:
            print(f"❌ Error downloading image: {str(e)}")
            raise

    def create_staged_upload(self, filename: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
        """Create staged upload URL for Shopify"""
        mutation = """
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
        """

        variables = {
            "input": [
                {
                    "resource": "IMAGE",
                    "filename": filename,
                    "mimeType": mime_type,
                    "httpMethod": "POST",
                }
            ]
        }

        response = requests.post(
            self.shopify_url,
            headers=self.headers,
            json={"query": mutation, "variables": variables},
        )

        data = response.json()

        if data.get("errors") or data["data"]["stagedUploadsCreate"]["userErrors"]:
            raise Exception(f"Error creating staged upload: {data}")

        return data["data"]["stagedUploadsCreate"]["stagedTargets"][0]

    def upload_image_to_shopify_s3(self, temp_file_path: str, filename: str) -> str:
        """Upload image to Shopify S3"""
        try:
            target = self.create_staged_upload(filename)
            upload_url = target["url"]
            resource_url = target["resourceUrl"]
            params = {param["name"]: param["value"] for param in target["parameters"]}

            with open(temp_file_path, "rb") as file_data:
                files = {"file": (filename, file_data, "image/jpeg")}
                upload_response = requests.post(
                    upload_url, data=params, files=files, timeout=60
                )

            # Clean up temp file
            try:
                os.unlink(temp_file_path)
            except:
                pass

            if upload_response.status_code not in [200, 201, 204]:
                raise Exception(f"S3 upload failed: {upload_response.status_code}")

            return resource_url

        except Exception as e:
            try:
                os.unlink(temp_file_path)
            except:
                pass
            raise e

    def process_images(self, image_urls: List[str]) -> List[str]:
        """Process list of image URLs"""
        if not image_urls:
            return []

        resource_urls = []
        for i, image_url in enumerate(image_urls):
            try:
                temp_file_path, filename = self.download_image_from_url(image_url)
                resource_url = self.upload_image_to_shopify_s3(temp_file_path, filename)
                resource_urls.append(resource_url)
                time.sleep(1)  # Rate limiting
            except Exception as e:
                print(f"❌ Failed to process image {i+1}: {str(e)}")
                continue

        return resource_urls

    def link_images_to_product(self, product_id: str, resource_urls: List[str], product_title: str = "") -> bool:
        """Link uploaded images to Shopify product"""
        if not resource_urls:
            return True

        try:
            media_mutation = """
            mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
              productCreateMedia(productId: $productId, media: $media) {
                media {
                  ... on MediaImage {
                    id
                  }
                }
                mediaUserErrors {
                  code
                  field
                  message
                }
              }
            }
            """

            media_items = []
            for i, resource_url in enumerate(resource_urls):
                media_items.append(
                    {
                        "alt": f"{product_title} - Image {i+1}" if product_title else f"Product Image {i+1}",
                        "mediaContentType": "IMAGE",
                        "originalSource": resource_url,
                    }
                )

            variables = {"productId": product_id, "media": media_items}
            response = requests.post(
                self.shopify_url,
                headers=self.headers,
                json={"query": media_mutation, "variables": variables},
                timeout=60,
            )

            if response.status_code != 200:
                return False

            data = response.json()
            if data.get("errors"):
                return False

            product_create_media = data.get("data", {}).get("productCreateMedia")
            if not product_create_media:
                return False

            errors = product_create_media.get("mediaUserErrors", [])
            if errors:
                return False

            return True

        except Exception as e:
            print(f"❌ Error linking images: {str(e)}")
            return False

    def update_variant_with_sku(self, product_id: str, variants_data: List[Dict], mongo_doc: Dict[str, Any]) -> bool:
        """Update variant with pricing and SKU"""
        try:
            if not variants_data:
                return False

            default_variant = variants_data[0].get("node", {})
            variant_id = default_variant.get("id")

            if not variant_id:
                return False

            # Get pricing from environment or use defaults
            price = float(os.getenv("DEFAULT_PRICE", "179.00"))
            compare_at_price = float(os.getenv("DEFAULT_COMPARE_PRICE", "224.00"))
            cost_per_item = float(os.getenv("DEFAULT_COST", "95.00"))

            sku = mongo_doc.get("sku", "")
            if not sku:
                return False

            variant_update_mutation = """
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
            """

            variant_update = {
                "id": variant_id,
                "price": str(price),
                "compareAtPrice": str(compare_at_price),
                "taxable": True,
                "inventoryPolicy": "DENY",
                "inventoryItem": {"sku": str(sku)},
            }

            variables = {"productId": product_id, "variants": [variant_update]}
            response = requests.post(
                self.shopify_url,
                headers=self.headers,
                json={"query": variant_update_mutation, "variables": variables},
                timeout=30,
            )

            if response.status_code != 200 or response.json().get("errors"):
                return False

            return True

        except Exception as e:
            print(f"❌ Error updating variant: {str(e)}")
            return False

    def create_shopify_product(self, mongo_doc: Dict[str, Any]) -> Optional[str]:
        """Create product in Shopify from MongoDB document"""
        try:
            # Format description
            description_html_parts = []
            if mongo_doc.get("description"):
                description_html_parts.append("<h3>Product Description:</h3><ul>")
                for item in mongo_doc["description"]:
                    description_html_parts.append(f"<li>{item}</li>")
                description_html_parts.append("</ul>")
            if mongo_doc.get("features"):
                description_html_parts.append("<h3>Features:</h3><ul>")
                for feature in mongo_doc["features"]:
                    description_html_parts.append(f"<li>{feature}</li>")
                description_html_parts.append("</ul>")
            if mongo_doc.get("warranty"):
                description_html_parts.append("<h3>Warranty:</h3><ul>")
                for item in mongo_doc["warranty"]:
                    description_html_parts.append(f"<li>{item}</li>")
                description_html_parts.append("</ul>")
            description_html = "".join(description_html_parts)

            # Generate tags
            tags = []
            if mongo_doc.get("category"):
                tags.append(f"Category_{mongo_doc['category']}")
            if mongo_doc.get("main_color"):
                tags.append(f"Colour_{mongo_doc['main_color']}")
            if mongo_doc.get("manufacturer"):
                tags.append(f"Brand_{mongo_doc['manufacturer']}")

            create_product_mutation = """
            mutation productCreate($product: ProductCreateInput!) {
              productCreate(product: $product) {
                product {
                  id
                  title
                  variants(first: 1) {
                    edges {
                      node {
                        id
                      }
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
            """

            product_data = {
                "title": str(mongo_doc.get("title", "Untitled Product")),
                "descriptionHtml": description_html,
                "vendor": str(mongo_doc.get("manufacturer", "Unknown")),
                "productType": "All Products",
                "status": "DRAFT",
                "tags": ",".join(tags),
                "productOptions": [
                    {"name": "Title", "values": [{"name": "Default Title"}]}
                ],
            }

            variables = {"product": product_data}
            response = requests.post(
                self.shopify_url,
                headers=self.headers,
                json={"query": create_product_mutation, "variables": variables},
                timeout=30,
            )

            if response.status_code != 200:
                return None

            data = response.json()
            if data.get("errors"):
                return None

            product = data.get("data", {}).get("productCreate", {}).get("product")
            if not product:
                return None

            product_id = product.get("id")

            # Update variant with SKU and pricing
            variants_data = product.get("variants", {}).get("edges", [])
            self.update_variant_with_sku(product_id, variants_data, mongo_doc)

            return product_id

        except Exception as e:
            print(f"❌ Error creating product: {str(e)}")
            return None

    def sync_product_by_sku(self, sku: str) -> Dict[str, Any]:
        """Sync a product to Shopify by SKU"""
        try:
            # Find product in MongoDB
            mongo_doc = self.collection.find_one({"sku": sku})
            
            if not mongo_doc:
                return {
                    "success": False,
                    "error": "Product not found",
                    "message": f"No product found with SKU: {sku}"
                }

            product_title = mongo_doc.get("title", "Untitled")

            # Create product in Shopify
            product_id = self.create_shopify_product(mongo_doc)
            
            if not product_id:
                return {
                    "success": False,
                    "error": "Failed to create product",
                    "message": "Could not create product in Shopify"
                }

            # Process images
            image_urls = mongo_doc.get("images", [])
            images_processed = 0
            
            if image_urls:
                resource_urls = self.process_images(image_urls)
                if resource_urls:
                    if self.link_images_to_product(product_id, resource_urls, product_title):
                        images_processed = len(resource_urls)

            return {
                "success": True,
                "message": "Product synced successfully",
                "data": {
                    "shopify_product_id": product_id,
                    "product_title": product_title,
                    "sku": sku,
                    "images_total": len(image_urls),
                    "images_processed": images_processed,
                    "category": mongo_doc.get("category"),
                    "manufacturer": mongo_doc.get("manufacturer")
                }
            }

        except Exception as e:
            return {
                "success": False,
                "error": "Sync failed",
                "message": str(e)
            }

    def close_connection(self):
        """Close MongoDB connection"""
        if hasattr(self, 'mongo_client'):
            self.mongo_client.close()

# FastAPI App
app = FastAPI(
    title="Simple Product API",
    version="1.0.0"
)

# CORS setup
origins_str = os.getenv("BACKEND_CORS_ORIGINS", '["http://localhost:3000"]')
try:
    allowed_origins = json.loads(origins_str)
except json.JSONDecodeError:
    print("WARNING: Could not parse BACKEND_CORS_ORIGINS. Using default.")
    allowed_origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
db_name = os.getenv("MONGO_DATABASE", "phoenix_products")
collection_name = os.getenv("MONGO_COLLECTION", "products")

client = pymongo.MongoClient(mongo_uri)
db = client[db_name]
collection = db[collection_name]

# API Routes
@app.get("/")
async def root():
    """API root"""
    return {"message": "Simple Product API is running", "docs": "/docs"}

@app.get("/health")
async def health():
    """Health check"""
    try:
        # Test MongoDB connection
        client.admin.command('ping')
        product_count = collection.count_documents({})
        
        # Test Shopify connection if credentials are available
        shopify_status = "not_configured"
        try:
            shopify_url = os.getenv("SHOPIFY_GRAPHQL_URL")
            shopify_token = os.getenv("SHOPIFY_ACCESS_TOKEN")
            if shopify_url and shopify_token:
                shopify_status = "configured"
            else:
                shopify_status = "missing_credentials"
        except:
            shopify_status = "error"
        
        return {
            "status": "healthy",
            "database": "connected",
            "products": product_count,
            "shopify": shopify_status
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

# NEW ENDPOINT: Get delta products (products not in Shopify)
@app.get("/api/delta/{vendor}")
async def get_delta_products(vendor: str):
    """
    Get products that exist in scraped collection but NOT in Shopify collection
    This helps identify products that need to be synced to Shopify
    """
    try:
        # Validate vendor
        if not vendor or len(vendor.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="Vendor parameter is required and cannot be empty"
            )
        
        vendor = vendor.strip().lower()
        
        # Get database
        db_name = os.getenv("MONGO_DATABASE", "phoenix_products")
        db = client[db_name]
        
        # Collection names
        scraped_collection_name = os.getenv("MONGO_COLLECTION", "products")
        shopify_collection_name = f"auspek_{vendor}"
        
        scraped_collection = db[scraped_collection_name]
        shopify_collection = db[shopify_collection_name]
        
        # Check if collections exist
        collection_names = db.list_collection_names()
        
        if scraped_collection_name not in collection_names:
            raise HTTPException(
                status_code=404,
                detail=f"Scraped collection '{scraped_collection_name}' not found"
            )
        
        if shopify_collection_name not in collection_names:
            # If Shopify collection doesn't exist, return all scraped products
            print(f"Shopify collection '{shopify_collection_name}' not found, returning all scraped products")
            scraped_products = list(scraped_collection.find(
                {}, 
                {
                    "sku": 1, 
                    "title": 1, 
                    "category": 1, 
                    "manufacturer": 1, 
                    "status": 1,
                    "images": 1,           # Include images
                    "description": 1,      # Include description
                    "main_color": 1,       # Include main color
                    "features": 1,         # Include features
                    "warranty": 1,         # Include warranty
                    "url": 1               # Include source URL
                }
            ))
            
            # Convert _id to string
            for product in scraped_products:
                product["id"] = str(product["_id"])
                del product["_id"]
            
            return {
                "success": True,
                "message": f"Shopify collection not found. Returning all {len(scraped_products)} scraped products",
                "data": {
                    "vendor": vendor,
                    "scraped_collection": scraped_collection_name,
                    "shopify_collection": shopify_collection_name,
                    "total_scraped": len(scraped_products),
                    "total_in_shopify": 0,
                    "delta_count": len(scraped_products),
                    "products_not_in_shopify": scraped_products
                }
            }
        
        # Get all SKUs from scraped collection with more complete product data
        scraped_products = list(scraped_collection.find(
            {"sku": {"$exists": True, "$ne": None, "$ne": ""}},
            {
                "sku": 1, 
                "title": 1, 
                "category": 1, 
                "manufacturer": 1, 
                "status": 1,
                "images": 1,           # Include images
                "description": 1,      # Include description
                "main_color": 1,       # Include main color
                "features": 1,         # Include features
                "warranty": 1,         # Include warranty
                "url": 1,              # Include source URL
                "colors": 1,           # Include available colors
                "breadcrumbs": 1       # Include breadcrumbs for context
            }
        ))
        
        scraped_skus = set()
        scraped_sku_to_product = {}
        
        for product in scraped_products:
            sku = product.get("sku")
            if sku:
                sku = str(sku).strip()
                if sku:
                    scraped_skus.add(sku)
                    product["id"] = str(product["_id"])
                    del product["_id"]
                    scraped_sku_to_product[sku] = product
        
        # Get all SKUs from Shopify collection (nested in variants)
        shopify_products = list(shopify_collection.find(
            {"variants.edges": {"$exists": True}},
            {"variants.edges.node.sku": 1}
        ))
        
        shopify_skus = set()
        
        for product in shopify_products:
            variants = product.get("variants", {}).get("edges", [])
            for variant in variants:
                node = variant.get("node", {})
                sku = node.get("sku")
                if sku:
                    sku = str(sku).strip()
                    if sku:
                        shopify_skus.add(sku)
        
        # Find delta (products in scraped but not in Shopify)
        delta_skus = scraped_skus - shopify_skus
        
        # Get full product details for delta SKUs
        delta_products = []
        for sku in delta_skus:
            if sku in scraped_sku_to_product:
                product = scraped_sku_to_product[sku]
                
                # Clean up and normalize product data for frontend
                # Ensure images is always a list
                if "images" in product and product["images"]:
                    if isinstance(product["images"], str):
                        product["images"] = [product["images"]]
                    elif not isinstance(product["images"], list):
                        product["images"] = []
                else:
                    product["images"] = []
                
                # Ensure description is properly formatted
                if "description" in product and product["description"]:
                    if isinstance(product["description"], list):
                        # Join list items with proper formatting
                        product["description_text"] = ". ".join(product["description"])
                    else:
                        product["description_text"] = str(product["description"])
                else:
                    product["description_text"] = ""
                
                # Add color information if available
                if "main_color" in product and product["main_color"]:
                    product["color"] = product["main_color"]
                elif "colors" in product and product["colors"] and len(product["colors"]) > 0:
                    product["color"] = product["colors"][0]
                else:
                    product["color"] = ""
                
                delta_products.append(product)
        
        # Sort by title for consistent ordering
        delta_products.sort(key=lambda x: x.get("title", "").lower())
        
        return {
            "success": True,
            "message": f"Found {len(delta_products)} products not in Shopify",
            "data": {
                "vendor": vendor,
                "scraped_collection": scraped_collection_name,
                "shopify_collection": shopify_collection_name,
                "total_scraped": len(scraped_skus),
                "total_in_shopify": len(shopify_skus),
                "delta_count": len(delta_products),
                "products_not_in_shopify": delta_products
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting delta products: {str(e)}"
        )

# NEW ENDPOINT: Fetch all Shopify products for a vendor
@app.post("/api/myweb/{website_name}")
async def fetch_shopify_products_for_vendor(website_name: str, request: ShopifyFetchRequest):
    """
    Fetch all Shopify products for a given vendor and store in auspek_{website_name} collection
    Deletes existing collection before fetching new data
    """
    try:
        # Validate inputs
        if not website_name or len(website_name.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="Website name is required and cannot be empty"
            )
        
        if not request.vendor or len(request.vendor.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="Vendor name is required and cannot be empty"
            )
        
        website_name = website_name.strip().lower()
        vendor = request.vendor.strip()
        
        # Initialize Shopify fetch service
        try:
            fetch_service = ShopifyFetchService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Shopify configuration error: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize Shopify fetch service: {str(e)}"
            )
        
        try:
            print(f"Starting fetch for vendor '{vendor}' to collection 'auspek_{website_name}'")
            
            # Fetch and store all products
            total_products = fetch_service.sync_all_shopify_products(vendor, website_name)
            
            return {
                "success": True,
                "message": f"Successfully fetched {total_products} products from Shopify",
                "data": {
                    "vendor": vendor,
                    "website_name": website_name,
                    "collection_name": f"auspek_{website_name}",
                    "total_products": total_products,
                    "timestamp": datetime.now().isoformat()
                }
            }
            
        finally:
            # Always close the connection
            fetch_service.close_connection()
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during fetch: {str(e)}"
        )

@app.get("/api/products")
async def get_products(
    page: int = 1,
    limit: int = 50,
    category: Optional[str] = None,
    search: Optional[str] = None
):
    """Get products with basic filtering"""
    try:
        # Build query
        query = {}
        if category:
            query["category"] = {"$regex": category, "$options": "i"}
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"sku": {"$regex": search, "$options": "i"}}
            ]
        
        # Get total count
        total = collection.count_documents(query)
        
        # Get products with pagination
        skip = (page - 1) * limit
        cursor = collection.find(query).skip(skip).limit(limit)
        
        products = []
        for doc in cursor:
            # Convert MongoDB _id to string
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            products.append(doc)
        
        return {
            "success": True,
            "products": products,
            "total": total,
            "page": page,
            "limit": limit,
            "has_next": skip + limit < total,
            "has_prev": page > 1
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/products/{product_id}")
async def get_product(product_id: str):
    """Get single product by ID or SKU"""
    try:
        # Try to find by SKU first
        product = collection.find_one({"sku": product_id})
        if not product:
            # Try by MongoDB _id
            try:
                from bson import ObjectId
                product = collection.find_one({"_id": ObjectId(product_id)})
            except:
                pass
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Convert _id to string
        product["id"] = str(product["_id"])
        del product["_id"]
        
        return {"success": True, "product": product}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scrape")
async def start_scraping():
    """Start scraping Phoenix products"""
    try:
        # Path to your scrapy project (adjust if needed)
        scrapy_path = "../"  # Since backend is inside webscraper folder
        
        # Check if scrapy project exists
        scrapy_cfg = os.path.join(scrapy_path, "scrapy.cfg")
        if not os.path.exists(scrapy_cfg):
            return {
                "success": False,
                "error": f"Scrapy project not found at {scrapy_path}",
                "message": "Make sure scrapy.cfg exists in parent directory"
            }
        
        # Run scrapy command
        result = subprocess.run([
            "scrapy", "crawl", "integrated_product",
            "-s", f"MONGO_DATABASE={db_name}",
            "-s", f"MONGO_COLLECTION={collection_name}", 
            "-s", f"MONGO_URI={mongo_uri}"
        ], 
        cwd=scrapy_path,
        capture_output=True, 
        text=True, 
        timeout=3000  # 50 minutes timeout
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "Scraping completed successfully",
                "output": result.stdout[-500:] if result.stdout else None  # Last 500 chars
            }
        else:
            return {
                "success": False,
                "error": "Scraping failed",
                "message": result.stderr or result.stdout,
                "return_code": result.returncode
            }
            
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Scraping timed out",
            "message": "Scraping took longer than expected"
        }
    except FileNotFoundError:
        return {
            "success": False,
            "error": "Scrapy command not found",
            "message": "Install scrapy with: pip install scrapy"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Unexpected error during scraping"
        }

@app.post("/api/list/bulk")
async def sync_multiple_products_to_shopify(request: BulkListRequest):
    """Sync multiple products to Shopify by SKUs"""
    try:
        # Validate request
        if not request.skus or len(request.skus) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one SKU is required"
            )
        
        # Remove duplicates and empty values
        unique_skus = list(set(sku.strip() for sku in request.skus if sku.strip()))
        
        if len(unique_skus) == 0:
            raise HTTPException(
                status_code=400,
                detail="No valid SKUs provided"
            )
        
        # Limit to prevent overload
        if len(unique_skus) > 50:
            raise HTTPException(
                status_code=400,
                detail="Cannot process more than 50 products at once"
            )
        
        # Check if all products exist in MongoDB first
        existing_products = list(collection.find(
            {"sku": {"$in": unique_skus}},
            {"sku": 1, "title": 1}
        ))
        
        existing_skus = {product["sku"] for product in existing_products}
        missing_skus = [sku for sku in unique_skus if sku not in existing_skus]
        
        if missing_skus:
            return {
                "success": False,
                "error": "Products not found",
                "message": f"The following SKUs were not found in database: {', '.join(missing_skus)}",
                "missing_skus": missing_skus,
                "found_skus": list(existing_skus)
            }
        
        # Initialize Shopify service
        try:
            shopify_service = ShopifySyncService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Shopify configuration error: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize Shopify service: {str(e)}"
            )
        
        # Process each product
        results = []
        successful_syncs = 0
        failed_syncs = 0
        
        try:
            for i, sku in enumerate(existing_skus):
                try:
                    print(f"📦 Processing product {i+1}/{len(existing_skus)}: {sku}")
                    result = shopify_service.sync_product_by_sku(sku)
                    
                    if result["success"]:
                        successful_syncs += 1
                        results.append({
                            "sku": sku,
                            "success": True,
                            "message": "Product synced successfully",
                            "shopify_product_id": result["data"]["shopify_product_id"]
                        })
                    else:
                        failed_syncs += 1
                        results.append({
                            "sku": sku,
                            "success": False,
                            "error": result.get("error", "Unknown error"),
                            "message": result.get("message", "Sync failed")
                        })
                    
                    if i < len(existing_skus) - 1: 
                        time.sleep(2)
                        
                except Exception as e:
                    failed_syncs += 1
                    results.append({
                        "sku": sku,
                        "success": False,
                        "error": "Processing error",
                        "message": str(e)
                    })
                    print(f"❌ Error processing {sku}: {str(e)}")
        
        finally:
            # Always close the connection
            shopify_service.close_connection()
        
        # Return comprehensive results
        overall_success = failed_syncs == 0
        
        return {
            "success": overall_success,
            "message": f"Bulk sync completed: {successful_syncs} successful, {failed_syncs} failed",
            "summary": {
                "total_requested": len(unique_skus),
                "total_processed": len(existing_skus),
                "successful": successful_syncs,
                "failed": failed_syncs,
                "success_rate": f"{(successful_syncs / len(existing_skus) * 100):.1f}%" if existing_skus else "0%"
            },
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during bulk sync: {str(e)}"
        )

# Put the single SKU endpoint AFTER the bulk endpoint
@app.post("/api/list/{sku}")
async def sync_product_to_shopify(sku: str):
    """Sync a product to Shopify by SKU"""
    try:
        # Validate SKU parameter
        if not sku or len(sku.strip()) == 0:
            raise HTTPException(
                status_code=400, 
                detail="SKU parameter is required and cannot be empty"
            )
        
        sku = sku.strip()
        
        # Check if product exists in MongoDB first
        product = collection.find_one({"sku": sku})
        if not product:
            raise HTTPException(
                status_code=404, 
                detail=f"Product not found in database with SKU: {sku}"
            )
        
        # Initialize Shopify service
        try:
            shopify_service = ShopifySyncService()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Shopify configuration error: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize Shopify service: {str(e)}"
            )
        
        try:
            # Sync product to Shopify
            result = shopify_service.sync_product_by_sku(sku)
            
            if result["success"]:
                return {
                    "success": True,
                    "message": f"Product '{sku}' successfully synced to Shopify",
                    "data": result["data"]
                }
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Sync failed: {result.get('message', 'Unknown error')}"
                )
                
        finally:
            # Always close the connection
            shopify_service.close_connection()
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during sync: {str(e)}"
        )
@app.post("/api/scrape/{vendor}")
async def start_vendor_scraping(vendor: str):
    """Start scraping for a specific vendor"""
    try:
        # Validate vendor parameter
        if not vendor or len(vendor.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="Vendor parameter is required and cannot be empty"
            )
        
        vendor = vendor.strip().lower()
        
        # List of valid vendors
        valid_vendors = ['phoenix', 'hansgrohe', 'moen', 'kohler']
        if vendor not in valid_vendors:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid vendor. Must be one of: {', '.join(valid_vendors)}"
            )
        
        # Check if scraping is already active for this vendor
        active_key = f"scraping_active_{vendor}"
        if redis_client and redis_client.get(active_key):
            return {
                "success": False,
                "error": "Scraping already active",
                "message": f"Scraping is already in progress for {vendor}"
            }
        
        # Mark scraping as active
        if redis_client:
            redis_client.setex(active_key, 300, "true")  # 5 minute expiry
        
        # Path to your scrapy project (adjust if needed)
        scrapy_path = "../"  # Since backend is inside webscraper folder
        
        # Check if scrapy project exists
        scrapy_cfg = os.path.join(scrapy_path, "scrapy.cfg")
        if not os.path.exists(scrapy_cfg):
            # Clean up active flag
            if redis_client:
                redis_client.delete(active_key)
            return {
                "success": False,
                "error": f"Scrapy project not found at {scrapy_path}",
                "message": "Make sure scrapy.cfg exists in parent directory"
            }
        
        # Run scrapy command with vendor-specific settings
        scrapy_command = [
            "scrapy", "crawl", f"{vendor}_spider",  # Assuming you have vendor-specific spiders
            "-s", f"MONGO_DATABASE={db_name}",
            "-s", f"MONGO_COLLECTION={collection_name}", 
            "-s", f"MONGO_URI={mongo_uri}",
            "-s", f"VENDOR={vendor.upper()}"
        ]
        
        # If you don't have vendor-specific spiders, use the integrated spider with vendor parameter
        if vendor == 'phoenix':
            scrapy_command = [
                "scrapy", "crawl", "integrated_product",
                "-s", f"MONGO_DATABASE={db_name}",
                "-s", f"MONGO_COLLECTION={collection_name}", 
                "-s", f"MONGO_URI={mongo_uri}",
                "-s", f"VENDOR=PHOENIX"
            ]
        
        # Start scraping process in background
        import threading
        
        def run_scraping():
            try:
                result = subprocess.run(
                    scrapy_command,
                    cwd=scrapy_path,
                    capture_output=True, 
                    text=True, 
                    timeout=3000  # 50 minutes timeout
                )
                
                # Store last scrape info
                last_scrape_key = f"last_scrape_{vendor}"
                scrape_info = {
                    "vendor": vendor,
                    "timestamp": datetime.now().isoformat(),
                    "success": result.returncode == 0,
                    "return_code": result.returncode,
                    "output": result.stdout[-1000:] if result.stdout else None,
                    "error": result.stderr[-1000:] if result.stderr else None
                }
                
                if redis_client:
                    redis_client.setex(last_scrape_key, 86400, json.dumps(scrape_info))  # Store for 24 hours
                
            except subprocess.TimeoutExpired:
                scrape_info = {
                    "vendor": vendor,
                    "timestamp": datetime.now().isoformat(),
                    "success": False,
                    "error": "Timeout",
                    "message": "Scraping timed out"
                }
                if redis_client:
                    redis_client.setex(last_scrape_key, 86400, json.dumps(scrape_info))
            
            except Exception as e:
                scrape_info = {
                    "vendor": vendor,
                    "timestamp": datetime.now().isoformat(),
                    "success": False,
                    "error": str(e),
                    "message": "Unexpected error during scraping"
                }
                if redis_client:
                    redis_client.setex(last_scrape_key, 86400, json.dumps(scrape_info))
            
            finally:
                # Clear active flag
                if redis_client:
                    redis_client.delete(active_key)
        
        # Start scraping in background thread
        scraping_thread = threading.Thread(target=run_scraping)
        scraping_thread.daemon = True
        scraping_thread.start()
        
        return {
            "success": True,
            "message": f"Scraping started for {vendor}",
            "vendor": vendor,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up active flag
        if redis_client:
            redis_client.delete(f"scraping_active_{vendor}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error starting scraping: {str(e)}"
        )

@app.get("/api/scrape/active/{vendor}")
async def check_scraping_active(vendor: str):
    """Check if scraping is currently active for a vendor"""
    try:
        vendor = vendor.strip().lower()
        active_key = f"scraping_active_{vendor}"
        
        is_active = False
        if redis_client:
            is_active = bool(redis_client.get(active_key))
        
        return {
            "success": True,
            "vendor": vendor,
            "active": is_active
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error checking scraping status: {str(e)}"
        )

@app.get("/api/scrape/info/{vendor}")
async def get_last_scrape_info(vendor: str):
    """Get last scrape information for a vendor"""
    try:
        vendor = vendor.strip().lower()
        last_scrape_key = f"last_scrape_{vendor}"
        
        if not redis_client:
            return {
                "success": True,
                "vendor": vendor,
                "lastScrape": None,
                "message": "Redis not available, no scrape history"
            }
        
        scrape_info_str = redis_client.get(last_scrape_key)
        if not scrape_info_str:
            return {
                "success": True,
                "vendor": vendor,
                "lastScrape": None,
                "message": "No scrape history available"
            }
        
        scrape_info = json.loads(scrape_info_str)
        return {
            "success": True,
            "vendor": vendor,
            "lastScrape": scrape_info.get("timestamp"),
            "scrapeSuccess": scrape_info.get("success"),
            "scrapeInfo": scrape_info
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting scrape info: {str(e)}"
        )

@app.get("/api/vendors")
async def get_vendors():
    """Get all available vendors"""
    return {
        "success": True,
        "vendors": [
            {
                "value": "phoenix",
                "label": "Phoenix Tapware",
                "website": "https://phoenixtapware.com.au",
                "active": True
            },
            {
                "value": "hansgrohe", 
                "label": "Hansgrohe",
                "website": "https://hansgrohe.com",
                "active": True
            },
            {
                "value": "moen",
                "label": "Moen", 
                "website": "https://moen.com",
                "active": True
            },
            {
                "value": "kohler",
                "label": "Kohler",
                "website": "https://kohler.com", 
                "active": True
            }
        ]
    }

@app.get("/api/vendors/{vendor}/status")
async def get_vendor_status(vendor: str):
    """Get comprehensive status for a vendor"""
    try:
        vendor = vendor.strip().lower()
        
        # Check if scraping is active
        active_key = f"scraping_active_{vendor}"
        is_active = False
        if redis_client:
            is_active = bool(redis_client.get(active_key))
        
        # Get last scrape info
        last_scrape_key = f"last_scrape_{vendor}"
        last_shopify_key = f"last_shopify_{vendor}"
        
        last_scrape = None
        last_shopify = None
        
        if redis_client:
            scrape_info_str = redis_client.get(last_scrape_key)
            if scrape_info_str:
                scrape_info = json.loads(scrape_info_str)
                last_scrape = scrape_info.get("timestamp")
            
            shopify_info_str = redis_client.get(last_shopify_key)
            if shopify_info_str:
                shopify_info = json.loads(shopify_info_str)
                last_shopify = shopify_info.get("timestamp")
        
        return {
            "success": True,
            "vendor": vendor,
            "isScrapingActive": is_active,
            "lastScrape": last_scrape,
            "lastShopifyFetch": last_shopify
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting vendor status: {str(e)}"
        )

# Update the existing Shopify fetch endpoint to store last fetch info
@app.post("/api/myweb/{website_name}")
async def fetch_shopify_products_for_vendor_enhanced(website_name: str, request: ShopifyFetchRequest):
    """
    Enhanced version that stores last fetch information
    """
    try:
        # Validate inputs
        if not website_name or len(website_name.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="Website name is required and cannot be empty"
            )
        
        if not request.vendor or len(request.vendor.strip()) == 0:
            raise HTTPException(
                status_code=400,
                detail="Vendor name is required and cannot be empty"
            )
        
        website_name = website_name.strip().lower()
        vendor = request.vendor.strip()
        
        # Check if Shopify fetch is already active
        active_key = f"shopify_active_{website_name}"
        if redis_client and redis_client.get(active_key):
            return {
                "success": False,
                "error": "Shopify fetch already active",
                "message": f"Shopify fetch is already in progress for {website_name}"
            }
        
        # Mark as active
        if redis_client:
            redis_client.setex(active_key, 300, "true")  # 5 minute expiry
        
        # Initialize Shopify fetch service
        try:
            fetch_service = ShopifyFetchService()
        except ValueError as e:
            if redis_client:
                redis_client.delete(active_key)
            raise HTTPException(
                status_code=500,
                detail=f"Shopify configuration error: {str(e)}"
            )
        except Exception as e:
            if redis_client:
                redis_client.delete(active_key)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize Shopify fetch service: {str(e)}"
            )
        
        try:
            print(f"Starting Shopify fetch for vendor '{vendor}' to collection 'auspek_{website_name}'")
            
            # Fetch and store all products
            total_products = fetch_service.sync_all_shopify_products(vendor, website_name)
            
            # Store last fetch info
            fetch_info = {
                "vendor": vendor,
                "website_name": website_name,
                "timestamp": datetime.now().isoformat(),
                "success": True,
                "total_products": total_products
            }
            
            if redis_client:
                last_fetch_key = f"last_shopify_{website_name}"
                redis_client.setex(last_fetch_key, 86400, json.dumps(fetch_info))  # Store for 24 hours
            
            return {
                "success": True,
                "message": f"Successfully fetched {total_products} products from Shopify",
                "data": {
                    "vendor": vendor,
                    "website_name": website_name,
                    "collection_name": f"auspek_{website_name}",
                    "total_products": total_products,
                    "timestamp": datetime.now().isoformat()
                }
            }
            
        except Exception as e:
            # Store error info
            error_info = {
                "vendor": vendor,
                "website_name": website_name,
                "timestamp": datetime.now().isoformat(),
                "success": False,
                "error": str(e)
            }
            
            if redis_client:
                last_fetch_key = f"last_shopify_{website_name}"
                redis_client.setex(last_fetch_key, 86400, json.dumps(error_info))
            
            raise HTTPException(
                status_code=500,
                detail=f"Error during Shopify fetch: {str(e)}"
            )
            
        finally:
            # Always close the connection and clear active flag
            fetch_service.close_connection()
            if redis_client:
                redis_client.delete(active_key)
            
    except HTTPException:
        raise
    except Exception as e:
        if redis_client:
            redis_client.delete(f"shopify_active_{website_name}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during fetch: {str(e)}"
        )

# Add Redis client initialization (add this near the top of your file)
import redis
import json
from datetime import datetime

# Initialize Redis client for storing scraping status (optional)
try:
    redis_client = redis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        db=int(os.getenv("REDIS_DB", 0)),
        decode_responses=True
    )
    # Test connection
    redis_client.ping()
    print("Redis connected successfully")
except Exception as e:
    print(f"Redis connection failed: {e}. Running without Redis.")
    redis_client = None

# Add this to your imports at the top
import threading
import subprocess
import json

# Update health check to include Redis status
@app.get("/health")
async def health_enhanced():
    """Enhanced health check"""
    try:
        # Test MongoDB connection
        client.admin.command('ping')
        product_count = collection.count_documents({})
        
        # Test Shopify connection if credentials are available
        shopify_status = "not_configured"
        try:
            shopify_url = os.getenv("SHOPIFY_GRAPHQL_URL")
            shopify_token = os.getenv("SHOPIFY_ACCESS_TOKEN")
            if shopify_url and shopify_token:
                shopify_status = "configured"
            else:
                shopify_status = "missing_credentials"
        except:
            shopify_status = "error"
        
        # Test Redis connection
        redis_status = "not_available"
        if redis_client:
            try:
                redis_client.ping()
                redis_status = "connected"
            except:
                redis_status = "error"
        
        return {
            "status": "healthy",
            "database": "connected",
            "products": product_count,
            "shopify": shopify_status,
            "redis": redis_status,
            "features": {
                "vendor_scraping": True,
                "shopify_sync": True,
                "gap_analysis": True,
                "status_tracking": redis_client is not None
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }