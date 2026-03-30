from typing import List, Optional
from pydantic import BaseModel, EmailStr


# ============== LOCATION MODELS ==============

class Location(BaseModel):
    id: str
    name: str
    slug: str
    address: str
    is_active: bool = True
    sort_order: int = 0
    wallet_enabled: bool = False
    reservation_enabled: bool = False
    phone: str = ""
    google_place_id: str = ""
    google_api_key: str = ""

class LocationCreate(BaseModel):
    name: str
    address: Optional[str] = ""
    wallet_enabled: bool = False
    reservation_enabled: bool = False
    phone: Optional[str] = ""
    google_place_id: Optional[str] = ""
    google_api_key: Optional[str] = ""

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    wallet_enabled: Optional[bool] = None
    reservation_enabled: Optional[bool] = None
    phone: Optional[str] = None
    google_place_id: Optional[str] = None
    google_api_key: Optional[str] = None


# ============== MENU MODELS ==============

class MenuItem(BaseModel):
    id: str
    location_id: str
    name: str
    subtitle: Optional[str] = ""
    description: Optional[str] = ""
    price: float
    original_price: Optional[float] = None
    image_url: Optional[str] = ""
    image_alt: Optional[str] = ""
    category: str
    categories: List[str] = []
    dietary: List[str] = []
    tags: List[str] = []
    featured: bool = False
    rating: float = 0.0
    review_count: int = 0
    prep_time: int = 0
    is_available: bool = True

class MenuItemCreate(BaseModel):
    location_id: str
    name: str
    subtitle: Optional[str] = ""
    description: Optional[str] = ""
    price: float
    original_price: Optional[float] = None
    image_url: Optional[str] = ""
    image_alt: Optional[str] = ""
    category: str
    categories: List[str] = []
    dietary: List[str] = []
    tags: List[str] = []
    featured: bool = False
    prep_time: int = 0
    is_available: bool = True

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    original_price: Optional[float] = None
    image_url: Optional[str] = None
    image_alt: Optional[str] = None
    category: Optional[str] = None
    categories: Optional[List[str]] = None
    dietary: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    featured: Optional[bool] = None
    prep_time: Optional[int] = None
    is_available: Optional[bool] = None


# ============== AUTH MODELS ==============

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str


# ============== CUSTOMER & ORDER MODELS ==============

class CustomerRegister(BaseModel):
    name: str
    email: str
    phone: str

class CustomerLogin(BaseModel):
    email: str
    password: str

class OrderItem(BaseModel):
    id: str
    name: str
    price: float
    quantity: int

class OrderCreate(BaseModel):
    location_id: str
    items: List[OrderItem]
    special_instructions: Optional[str] = ""

class OrderStatusUpdate(BaseModel):
    status: str

class SiteSettingsUpdate(BaseModel):
    ordering_enabled: Optional[bool] = None
    manual_override: Optional[bool] = None
    opening_hours: Optional[dict] = None


# ============== RESIDENT MODELS ==============

class ResidentCreate(BaseModel):
    residence_number: str
    name: str
    location: str
    email: Optional[str] = None
    about: Optional[str] = None

class ResidentUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    about: Optional[str] = None

class TransactionCreate(BaseModel):
    resident_id: str
    transaction_type: str
    amount: float
    description: Optional[str] = None
    send_receipt: bool = False


# ============== CONTACT MODEL ==============

class ContactMessage(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    subject: Optional[str] = ""
    message: str
    location_id: Optional[str] = ""
    _hp: Optional[str] = ""
    _ts: Optional[int] = 0

    class Config:
        extra = "allow"
