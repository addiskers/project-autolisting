import os
import json
from typing import List
from dotenv import load_dotenv

load_dotenv()
class Settings:
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    MONGO_DATABASE: str = os.getenv("MONGO_DATABASE", "phoenix_products")
    MONGO_COLLECTION: str = os.getenv("MONGO_COLLECTION", "products")
    
    SHOPIFY_GRAPHQL_URL: str = os.getenv("SHOPIFY_GRAPHQL_URL", "")
    SHOPIFY_ACCESS_TOKEN: str = os.getenv("SHOPIFY_ACCESS_TOKEN", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    DEFAULT_PRICE: float = float(os.getenv("DEFAULT_PRICE", "179.00"))
    DEFAULT_COMPARE_PRICE: float = float(os.getenv("DEFAULT_COMPARE_PRICE", "224.00"))
    DEFAULT_COST: float = float(os.getenv("DEFAULT_COST", "95.00"))
    
    @property
    def BACKEND_CORS_ORIGINS(self) -> List[str]:
        origins_str = os.getenv("BACKEND_CORS_ORIGINS", '["http://localhost:3000"]')
        try:
            return json.loads(origins_str)
        except json.JSONDecodeError:
            print("WARNING: Could not parse BACKEND_CORS_ORIGINS. Using default.")
            return ["http://localhost:3000"]

settings = Settings()