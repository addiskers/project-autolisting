import os
import time
import tempfile
import requests
import pymongo
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse
from ..core.config import settings
from .openai_service import OpenAIContentService

class ShopifySyncService:
    def __init__(self):
        self.shopify_url = settings.SHOPIFY_GRAPHQL_URL
        self.access_token = settings.SHOPIFY_ACCESS_TOKEN
        
        if not self.shopify_url or not self.access_token:
            raise ValueError("Missing Shopify credentials in environment variables")
            
        self.headers = {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": self.access_token,
        }

        self.mongo_client = pymongo.MongoClient(settings.MONGO_URI)
        self.db = self.mongo_client[settings.MONGO_DATABASE]
        self.collection = self.db[settings.MONGO_COLLECTION]
        self.openai_service = OpenAIContentService()

    async def generate_and_store_ai_content(self, sku: str, force_regenerate: bool = True) -> Dict[str, Any]:
        """Generate AI content and store it in MongoDB - ALWAYS regenerates by default"""
        try:
            print(f"Generating AI content for SKU: {sku} (always regenerating)")
            
            mongo_doc = self.collection.find_one({"sku": sku})
            if not mongo_doc:
                raise ValueError(f"Product not found with SKU: {sku}")
            
            # Always generate AI content regardless of existing content
            print(f"DEBUG: Always regenerating AI content for SKU: {sku}")
            
            # Generate AI content
            ai_content = await self.openai_service.generate_all_content(mongo_doc)
            
            # Store in MongoDB
            update_data = {
                "gen_description": ai_content["gen_description"],
                "gen_title": ai_content["gen_title"],
                "gen_tags": ai_content["gen_tags"],
                "gen_collection": ai_content["gen_collection"],
                "ai_generated_at": datetime.utcnow(),
                "ai_regenerated_at": datetime.utcnow()  # Always mark as regenerated
            }
            
            update_result = self.collection.update_one(
                {"sku": sku},
                {"$set": update_data}
            )
            
            if update_result.modified_count == 0:
                raise Exception("Failed to update product with AI content")
            
            print(f"AI content regenerated successfully for SKU: {sku}")
            
            return {
                "success": True,
                "message": "AI content regenerated successfully",
                "generated": True,
                "regenerated": True,  # Always True since we always regenerate
                "data": ai_content
            }
            
        except Exception as e:
            print(f"ERROR: Failed to generate AI content for SKU {sku}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "generated": False
            }

    async def generate_bulk_ai_content(self, skus: List[str], force_regenerate: bool = True) -> Dict[str, Any]:
        """Generate AI content for multiple products - ALWAYS regenerates"""
        try:
            print(f"Starting bulk AI generation for {len(skus)} SKUs (always regenerating)")
            
            # Get products from database
            products = list(self.collection.find(
                {"sku": {"$in": skus}},
                {
                    "sku": 1, "title": 1, "category": 1, "manufacturer": 1,
                    "features": 1, "colors": 1, "description": 1, "main_color": 1,
                    "gen_description": 1, "gen_title": 1, "gen_tags": 1, "gen_collection": 1
                }
            ))
            
            found_skus = {product["sku"]: product for product in products}
            missing_skus = [sku for sku in skus if sku not in found_skus]
            
            if missing_skus:
                return {
                    "success": False,
                    "error": "Products not found",
                    "missing_skus": missing_skus,
                    "found_skus": list(found_skus.keys())
                }
            
            # Always regenerate AI content for all products
            print(f"Regenerating AI content for all {len(products)} products")
            
            results = []
            
            # Generate AI content for all products
            ai_results = await self.openai_service.generate_bulk_content(products)
            
            # Store results in database
            for i, product in enumerate(products):
                sku = product["sku"]
                ai_result = ai_results[i]
                
                if "error" in ai_result:
                    print(f"ERROR: AI generation failed for SKU {sku}: {ai_result['error']}")
                    results.append({
                        "sku": sku,
                        "success": False,
                        "error": ai_result["error"],
                        "generated": False
                    })
                    continue
                
                try:
                    # Update in database
                    update_data = {
                        "gen_description": ai_result["gen_description"],
                        "gen_title": ai_result["gen_title"],
                        "gen_tags": ai_result["gen_tags"],
                        "gen_collection": ai_result["gen_collection"],
                        "ai_generated_at": datetime.utcnow(),
                        "ai_regenerated_at": datetime.utcnow()  # Always mark as regenerated
                    }
                    
                    update_result = self.collection.update_one(
                        {"sku": sku},
                        {"$set": update_data}
                    )
                    
                    if update_result.modified_count > 0:
                        results.append({
                            "sku": sku,
                            "success": True,
                            "message": "AI content regenerated successfully",
                            "generated": True,
                            "regenerated": True,  # Always True
                            "data": ai_result
                        })
                    else:
                        results.append({
                            "sku": sku,
                            "success": False,
                            "error": "Failed to update database",
                            "generated": False
                        })
                        
                except Exception as e:
                    print(f"ERROR: Database update failed for SKU {sku}: {str(e)}")
                    results.append({
                        "sku": sku,
                        "success": False,
                        "error": f"Database update failed: {str(e)}",
                        "generated": False
                    })
            
            successful = sum(1 for r in results if r["success"])
            failed = len(results) - successful
            generated = sum(1 for r in results if r.get("generated", False))
            
            return {
                "success": failed == 0,
                "message": f"AI content generation completed: {successful} successful, {failed} failed, {generated} regenerated",
                "summary": {
                    "total_processed": len(results),
                    "successful": successful,
                    "failed": failed,
                    "regenerated": generated,  # All successful ones are regenerated
                    "already_existed": 0,  # No longer relevant since we always regenerate
                    "force_regenerated": generated  # Same as regenerated
                },
                "results": results
            }
            
        except Exception as e:
            print(f"ERROR: Bulk AI generation failed: {str(e)}")
            return {
                "success": False,
                "error": f"Bulk AI generation failed: {str(e)}"
            }

    # ... (keep all the existing image processing methods unchanged) ...
    def download_image_from_url(self, image_url: str) -> tuple[str, str]:
        try:
            print(f"Downloading image: {image_url}")

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

            parsed_url = urlparse(image_url)
            filename = os.path.basename(parsed_url.path)
            if not filename or "." not in filename:
                filename = f"image_{int(time.time())}.jpg"

            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}")

            total_size = 0
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    temp_file.write(chunk)
                    total_size += len(chunk)

            temp_file.close()
            print(f"Downloaded {total_size} bytes")
            return temp_file.name, filename

        except Exception as e:
            print(f"Error downloading image: {str(e)}")
            raise

    def create_staged_upload(self, filename: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
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
        if not image_urls:
            return []

        resource_urls = []
        for i, image_url in enumerate(image_urls):
            try:
                temp_file_path, filename = self.download_image_from_url(image_url)
                resource_url = self.upload_image_to_shopify_s3(temp_file_path, filename)
                resource_urls.append(resource_url)
                time.sleep(1)
            except Exception as e:
                print(f"Failed to process image {i+1}: {str(e)}")
                continue

        return resource_urls

    def link_images_to_product(self, product_id: str, resource_urls: List[str], product_title: str = "") -> bool:
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
            print(f"Error linking images: {str(e)}")
            return False

    def update_variant_with_sku(self, product_id: str, variants_data: List[Dict], mongo_doc: Dict[str, Any]) -> bool:
        try:
            if not variants_data:
                return False

            default_variant = variants_data[0].get("node", {})
            variant_id = default_variant.get("id")

            if not variant_id:
                return False

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
                "price": str(settings.DEFAULT_PRICE),
                "compareAtPrice": str(settings.DEFAULT_COMPARE_PRICE),
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
            print(f"Error updating variant: {str(e)}")
            return False

    def create_shopify_product(self, mongo_doc: Dict[str, Any]) -> Optional[str]:
        try:
            print(f"DEBUG: Creating Shopify product for SKU: {mongo_doc.get('sku', 'Unknown')}")
            
            description_html = mongo_doc.get("gen_description", "")
            print(f"DEBUG: Using AI description: {bool(description_html)}")
            
            if not description_html:
                print("DEBUG: Falling back to original description logic")
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

            tags = []
            if mongo_doc.get("gen_tags"):
                # Ensure gen_tags is a list
                gen_tags = mongo_doc["gen_tags"]
                if isinstance(gen_tags, list):
                    tags = gen_tags
                elif isinstance(gen_tags, str):
                    # If it's a string, split by comma and clean up
                    tags = [tag.strip() for tag in gen_tags.split(",") if tag.strip()]
                print(f"DEBUG: Using AI tags: {tags}")
            else:
                print("DEBUG: Falling back to original tag logic")
                if mongo_doc.get("category"):
                    tags.append(f"Category_{mongo_doc['category']}")
                if mongo_doc.get("main_color"):
                    tags.append(f"Colour_{mongo_doc['main_color']}")
                if mongo_doc.get("manufacturer"):
                    tags.append(f"Brand_{mongo_doc['manufacturer']}")

            product_title = mongo_doc.get("gen_title") or mongo_doc.get("title", "Untitled Product")
            print(f"DEBUG: Using title: '{product_title}' (AI: {bool(mongo_doc.get('gen_title'))})")

            create_product_mutation = """
            mutation productCreate($product: ProductCreateInput!) {
            productCreate(product: $product) {
                product {
                id
                title
                tags
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
                "title": str(product_title),
                "descriptionHtml": description_html,
                "vendor": str(mongo_doc.get("manufacturer", "Unknown")),
                "productType": "All Products",
                "status": "DRAFT",
                "tags": tags,  # Changed: Pass as array instead of comma-separated string
                "productOptions": [
                    {"name": "Title", "values": [{"name": "Default Title"}]}
                ],
            }

            print(f"DEBUG: Creating product with data: {product_data}")

            variables = {"product": product_data}
            response = requests.post(
                self.shopify_url,
                headers=self.headers,
                json={"query": create_product_mutation, "variables": variables},
                timeout=30,
            )

            if response.status_code != 200:
                print(f"ERROR: Shopify API request failed with status: {response.status_code}")
                return None

            data = response.json()
            if data.get("errors"):
                print(f"ERROR: Shopify API errors: {data['errors']}")
                return None

            product = data.get("data", {}).get("productCreate", {}).get("product")
            if not product:
                user_errors = data.get("data", {}).get("productCreate", {}).get("userErrors", [])
                print(f"ERROR: Product creation failed. User errors: {user_errors}")
                return None

            product_id = product.get("id")
            print(f"DEBUG: Successfully created Shopify product with ID: {product_id}")
            print(f"DEBUG: Created with tags: {product.get('tags', [])}")

            variants_data = product.get("variants", {}).get("edges", [])
            self.update_variant_with_sku(product_id, variants_data, mongo_doc)

            return product_id

        except Exception as e:
            print(f"ERROR: Exception creating product: {str(e)}")
            return None

    def mark_product_as_listed(self, sku: str, shopify_product_id: str) -> bool:
        """Mark a product as listed on Shopify in the database"""
        try:
            result = self.collection.update_one(
                {"sku": sku},
                {
                    "$set": {
                        "listed_on_shopify": True,
                        "shopify_product_id": shopify_product_id,
                        "listed_at": datetime.utcnow(),
                        "last_listed": datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error marking product as listed: {str(e)}")
            return False

    def check_product_listing_status(self, sku: str) -> Dict[str, Any]:
        """Check if a product is already listed on Shopify"""
        try:
            product = self.collection.find_one({"sku": sku})
            if not product:
                return {
                    "exists": False,
                    "listed": False,
                    "message": "Product not found"
                }

            return {
                "exists": True,
                "listed": product.get("listed_on_shopify", False),
                "shopify_product_id": product.get("shopify_product_id"),
                "listed_at": product.get("listed_at"),
                "last_listed": product.get("last_listed"),
                "title": product.get("title", "Unknown Product"),
                "has_ai_content": all(key in product for key in ["gen_description", "gen_title", "gen_tags", "gen_collection"])
            }
        except Exception as e:
            print(f"Error checking product listing status: {str(e)}")
            return {
                "exists": False,
                "listed": False,
                "message": f"Error checking status: {str(e)}"
            }

    async def sync_product_by_sku(self, sku: str, force_relist: bool = True, force_regenerate_ai: bool = True) -> Dict[str, Any]:
        """Sync product to Shopify - ALWAYS regenerates AI content and ALWAYS relists"""
        try:
            print(f"DEBUG: Starting sync for SKU: {sku} (ALWAYS regenerate AI + relist)")
            
            mongo_doc = self.collection.find_one({"sku": sku})
            
            if not mongo_doc:
                return {
                    "success": False,
                    "error": "Product not found",
                    "message": f"No product found with SKU: {sku}"
                }

            print(f"DEBUG: Always generating AI content for SKU: {sku}")
            ai_result = await self.generate_and_store_ai_content(sku, force_regenerate=True)
            
            if not ai_result["success"]:
                print(f"ERROR: AI content generation failed for SKU {sku}: {ai_result.get('error')}")
                return {
                    "success": False,
                    "error": "AI content generation failed",
                    "message": f"Failed to generate AI content: {ai_result.get('error', 'Unknown error')}"
                }
            
            # Refresh the document with AI content
            mongo_doc = self.collection.find_one({"sku": sku})
            print(f"DEBUG: Refreshed document, AI content now available")

            product_title = mongo_doc.get("gen_title") or mongo_doc.get("title", "Untitled")
            print(f"DEBUG: Final product title: '{product_title}'")

            # Create Shopify product (this will create a NEW product every time)
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
                print(f"DEBUG: Processing {len(image_urls)} images")
                resource_urls = self.process_images(image_urls)
                if resource_urls:
                    if self.link_images_to_product(product_id, resource_urls, product_title):
                        images_processed = len(resource_urls)

            # Mark product as listed in database
            self.mark_product_as_listed(sku, product_id)

            print(f"DEBUG: Successfully synced product {sku} to Shopify with ID: {product_id}")

            return {
                "success": True,
                "message": "Product synced successfully with freshly generated AI content",
                "data": {
                    "shopify_product_id": product_id,
                    "product_title": product_title,
                    "sku": sku,
                    "images_total": len(image_urls),
                    "images_processed": images_processed,
                    "category": mongo_doc.get("category"),
                    "manufacturer": mongo_doc.get("manufacturer"),
                    "listed_at": datetime.utcnow().isoformat(),
                    "ai_content": {
                        "gen_title": mongo_doc.get("gen_title"),
                        "gen_tags": mongo_doc.get("gen_tags"),
                        "gen_collection": mongo_doc.get("gen_collection"),
                        "has_description": bool(mongo_doc.get("gen_description")),
                        "regenerated": True  # Always True now
                    }
                }
            }

        except Exception as e:
            print(f"ERROR: Sync failed for SKU {sku}: {str(e)}")
            return {
                "success": False,
                "error": "Sync failed",
                "message": str(e)
            }

    def get_multiple_listing_status(self, skus: List[str]) -> Dict[str, Dict[str, Any]]:
        """Get listing status for multiple SKUs"""
        try:
            products = list(self.collection.find(
                {"sku": {"$in": skus}},
                {
                    "sku": 1, "listed_on_shopify": 1, "shopify_product_id": 1, 
                    "listed_at": 1, "title": 1, "gen_description": 1, 
                    "gen_title": 1, "gen_tags": 1, "gen_collection": 1
                }
            ))
            
            result = {}
            for sku in skus:
                product = next((p for p in products if p.get("sku") == sku), None)
                if product:
                    result[sku] = {
                        "exists": True,
                        "listed": product.get("listed_on_shopify", False),
                        "shopify_product_id": product.get("shopify_product_id"),
                        "listed_at": product.get("listed_at"),
                        "title": product.get("title", "Unknown Product"),
                        "has_ai_content": all(key in product for key in ["gen_description", "gen_title", "gen_tags", "gen_collection"])
                    }
                else:
                    result[sku] = {
                        "exists": False,
                        "listed": False,
                        "message": "Product not found"
                    }
            
            return result
        except Exception as e:
            print(f"Error getting multiple listing status: {str(e)}")
            return {}

    def close_connection(self):
        if hasattr(self, 'mongo_client'):
            self.mongo_client.close()