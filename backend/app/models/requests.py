from pydantic import BaseModel
from typing import List

class BulkListRequest(BaseModel):
    skus: List[str]

class ShopifyFetchRequest(BaseModel):
    vendor: str