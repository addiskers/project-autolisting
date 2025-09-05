from pydantic import BaseModel
from typing import List, Optional

class BulkListRequest(BaseModel):
    skus: List[str]
    force_relist: Optional[bool] = True
    force_regenerate_ai: Optional[bool] = True

class ShopifyFetchRequest(BaseModel):
    vendor: str

class AIGenerationRequest(BaseModel):
    sku: str
    force_regenerate: Optional[bool] = False