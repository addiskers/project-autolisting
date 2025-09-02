import os
import time
import requests
import pymongo
from datetime import datetime
from typing import Optional, Dict, Any

class ShopifyFetchService:
    def __init__(self):
        self.shopify_url = os.getenv("SHOPIFY_GRAPHQL_URL")
        self.access_token = os.getenv("SHOPIFY_ACCESS_TOKEN")
        
        if not self.shopify_url or not self.access_token:
            raise ValueError("Missing Shopify credentials in environment variables")
            
        self.headers = {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": self.access_token,
        }

        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.mongo_client = pymongo.MongoClient(mongo_uri)

    def fetch_shopify_products(self, cursor=None, vendor="SYDPEK"):
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
        if not products_data or "data" not in products_data:
            print("No valid product data to store")
            return 0

        products = products_data["data"]["products"]["edges"]
        stored_count = 0

        for product_edge in products:
            try:
                product = product_edge["node"]

                product["_imported_at"] = datetime.now()
                product["_source"] = "shopify_graphql"

                result = collection.insert_one(product)
                if result.inserted_id is not None:
                    stored_count += 1
                    print(f"Stored product: {product['title']} (ID: {product['id']})")

            except Exception as e:
                print(f"Error storing product {product.get('title', 'Unknown')}: {e}")
                continue

        return stored_count

    def sync_all_shopify_products(self, vendor, website_name):
        db_name = os.getenv("MONGO_DATABASE", "phoenix_products")
        db = self.mongo_client[db_name]
        collection_name = f"auspek_{website_name}"
        collection = db[collection_name]

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

            response_data = self.fetch_shopify_products(cursor, vendor)

            if not response_data:
                print("Failed to fetch data from Shopify")
                break

            if "errors" in response_data:
                print(f"GraphQL errors: {response_data['errors']}")
                break

            stored_count = self.store_products_in_mongodb(response_data, collection)
            total_products += stored_count

            page_info = response_data["data"]["products"]["pageInfo"]
            has_next_page = page_info.get("hasNextPage", False)

            print(f"Page {page_number}: Stored {stored_count} products")

            if not has_next_page:
                print("No more pages to fetch")
                break

            cursor = page_info.get("endCursor")
            if not cursor:
                print("No cursor for next page")
                break

            page_number += 1
            
            time.sleep(0.5)

        print(f"Sync completed! Total products stored: {total_products}")
        return total_products

    def close_connection(self):
        if hasattr(self, 'mongo_client'):
            self.mongo_client.close()