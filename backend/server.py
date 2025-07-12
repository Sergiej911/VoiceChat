from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Union, Any
from pydantic import BaseModel, Field, EmailStr
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
import uuid
import json
import asyncio

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        self.room_participants: Dict[str, List[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
            self.room_participants[room_id] = []
        
        self.active_connections[room_id][user_id] = websocket
        if user_id not in self.room_participants[room_id]:
            self.room_participants[room_id].append(user_id)

    def disconnect(self, user_id: str, room_id: str):
        if room_id in self.active_connections and user_id in self.active_connections[room_id]:
            del self.active_connections[room_id][user_id]
            if user_id in self.room_participants[room_id]:
                self.room_participants[room_id].remove(user_id)
            
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
                del self.room_participants[room_id]

    async def send_personal_message(self, message: str, user_id: str, room_id: str):
        if room_id in self.active_connections and user_id in self.active_connections[room_id]:
            await self.active_connections[room_id][user_id].send_text(message)

    async def broadcast_to_room(self, message: str, room_id: str, exclude_user: str = None):
        if room_id in self.active_connections:
            for user_id, websocket in self.active_connections[room_id].items():
                if user_id != exclude_user:
                    try:
                        await websocket.send_text(message)
                    except:
                        pass

manager = ConnectionManager()

# Pydantic models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    username: str
    password_hash: str
    avatar_url: Optional[str] = None
    is_online: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    avatar_url: Optional[str] = None
    is_online: bool
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class ChatRoom(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: Optional[str] = None
    language: str
    level: str
    max_users: int = 8
    is_private: bool = False
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    participants: List[str] = Field(default_factory=list)
    active_speakers: List[str] = Field(default_factory=list)

class ChatRoomCreate(BaseModel):
    name: Optional[str] = None
    language: str
    level: str
    max_users: int = 8
    is_private: bool = False

class ChatRoomResponse(BaseModel):
    id: str
    name: Optional[str]
    language: str
    level: str
    max_users: int
    is_private: bool
    created_by: str
    created_at: datetime
    participants: List[UserResponse] = []
    participant_count: int
    is_full: bool
    active_speakers: List[str] = []

class WebRTCOffer(BaseModel):
    room_id: str
    from_user: str
    to_user: str
    offer: Dict[str, Any]

class WebRTCAnswer(BaseModel):
    room_id: str
    from_user: str
    to_user: str
    answer: Dict[str, Any]

class ICECandidate(BaseModel):
    room_id: str
    from_user: str
    to_user: str
    candidate: Dict[str, Any]

class VoiceStatus(BaseModel):
    room_id: str
    user_id: str
    is_speaking: bool
    is_muted: bool

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    
    return User(**user)

# Create FastAPI app
app = FastAPI(title="Free4Talk API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication endpoints
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="Username already taken"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        username=user_data.username,
        password_hash=hashed_password,
        is_online=True
    )
    
    await db.users.insert_one(user.dict())
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    user_response = UserResponse(**user.dict())
    return Token(access_token=access_token, token_type="bearer", user=user_response)

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update user online status
    await db.users.update_one(
        {"email": user_data.email},
        {"$set": {"is_online": True, "last_active": datetime.utcnow()}}
    )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]}, expires_delta=access_token_expires
    )
    
    user_response = UserResponse(**user)
    return Token(access_token=access_token, token_type="bearer", user=user_response)

@api_router.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    await db.users.update_one(
        {"email": current_user.email},
        {"$set": {"is_online": False, "last_active": datetime.utcnow()}}
    )
    return {"message": "Successfully logged out"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(**current_user.dict())

# Room management endpoints
@api_router.get("/rooms", response_model=List[ChatRoomResponse])
async def get_rooms():
    rooms = await db.rooms.find().to_list(1000)
    response_rooms = []
    
    for room in rooms:
        # Get participant details
        participants = []
        if room["participants"]:
            participant_users = await db.users.find({"id": {"$in": room["participants"]}}).to_list(1000)
            participants = [UserResponse(**user) for user in participant_users]
        
        room_dict = room.copy()
        room_dict.pop('participants', None)  # Remove participants to avoid conflict
        room_response = ChatRoomResponse(
            **room_dict,
            participants=participants,
            participant_count=len(room["participants"]),
            is_full=len(room["participants"]) >= room["max_users"]
        )
        response_rooms.append(room_response)
    
    return response_rooms

@api_router.post("/rooms", response_model=ChatRoomResponse)
async def create_room(room_data: ChatRoomCreate, current_user: User = Depends(get_current_user)):
    room = ChatRoom(
        **room_data.dict(),
        created_by=current_user.id,
        participants=[current_user.id]
    )
    
    await db.rooms.insert_one(room.dict())
    
    user_response = UserResponse(**current_user.dict())
    room_dict = room.dict()
    room_dict.pop('participants', None)  # Remove participants from room dict to avoid conflict
    return ChatRoomResponse(
        **room_dict,
        participants=[user_response],
        participant_count=1,
        is_full=False
    )

@api_router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if len(room["participants"]) >= room["max_users"]:
        raise HTTPException(status_code=400, detail="Room is full")
    
    if current_user.id not in room["participants"]:
        await db.rooms.update_one(
            {"id": room_id},
            {"$push": {"participants": current_user.id}}
        )
    
    # Notify other participants
    await manager.broadcast_to_room(
        json.dumps({
            "type": "user_joined",
            "user": UserResponse(**current_user.dict()).dict(),
            "room_id": room_id
        }),
        room_id,
        exclude_user=current_user.id
    )
    
    return {"message": "Successfully joined room"}

@api_router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if current_user.id in room["participants"]:
        await db.rooms.update_one(
            {"id": room_id},
            {"$pull": {"participants": current_user.id, "active_speakers": current_user.id}}
        )
    
    # Disconnect from WebSocket
    manager.disconnect(current_user.id, room_id)
    
    # Notify other participants
    await manager.broadcast_to_room(
        json.dumps({
            "type": "user_left",
            "user_id": current_user.id,
            "room_id": room_id
        }),
        room_id
    )
    
    # Delete room if empty and not the creator
    updated_room = await db.rooms.find_one({"id": room_id})
    if not updated_room["participants"]:
        await db.rooms.delete_one({"id": room_id})
    
    return {"message": "Successfully left room"}

@api_router.get("/rooms/{room_id}", response_model=ChatRoomResponse)
async def get_room(room_id: str):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Get participant details
    participants = []
    if room["participants"]:
        participant_users = await db.users.find({"id": {"$in": room["participants"]}}).to_list(1000)
        participants = [UserResponse(**user) for user in participant_users]
    
    room_dict = room.copy()
    room_dict.pop('participants', None)  # Remove participants to avoid conflict
    return ChatRoomResponse(
        **room_dict,
        participants=participants,
        participant_count=len(room["participants"]),
        is_full=len(room["participants"]) >= room["max_users"]
    )

# WebRTC signaling endpoints
@api_router.post("/webrtc/offer")
async def send_offer(offer_data: WebRTCOffer, current_user: User = Depends(get_current_user)):
    await manager.send_personal_message(
        json.dumps({
            "type": "webrtc_offer",
            "from_user": offer_data.from_user,
            "offer": offer_data.offer
        }),
        offer_data.to_user,
        offer_data.room_id
    )
    return {"message": "Offer sent"}

@api_router.post("/webrtc/answer")
async def send_answer(answer_data: WebRTCAnswer, current_user: User = Depends(get_current_user)):
    await manager.send_personal_message(
        json.dumps({
            "type": "webrtc_answer",
            "from_user": answer_data.from_user,
            "answer": answer_data.answer
        }),
        answer_data.to_user,
        answer_data.room_id
    )
    return {"message": "Answer sent"}

@api_router.post("/webrtc/ice-candidate")
async def send_ice_candidate(candidate_data: ICECandidate, current_user: User = Depends(get_current_user)):
    await manager.send_personal_message(
        json.dumps({
            "type": "ice_candidate",
            "from_user": candidate_data.from_user,
            "candidate": candidate_data.candidate
        }),
        candidate_data.to_user,
        candidate_data.room_id
    )
    return {"message": "ICE candidate sent"}

@api_router.post("/voice/status")
async def update_voice_status(voice_data: VoiceStatus, current_user: User = Depends(get_current_user)):
    if voice_data.is_speaking:
        await db.rooms.update_one(
            {"id": voice_data.room_id},
            {"$addToSet": {"active_speakers": voice_data.user_id}}
        )
    else:
        await db.rooms.update_one(
            {"id": voice_data.room_id},
            {"$pull": {"active_speakers": voice_data.user_id}}
        )
    
    # Broadcast voice status update
    await manager.broadcast_to_room(
        json.dumps({
            "type": "voice_status_update",
            "user_id": voice_data.user_id,
            "is_speaking": voice_data.is_speaking,
            "is_muted": voice_data.is_muted
        }),
        voice_data.room_id,
        exclude_user=current_user.id
    )
    
    return {"message": "Voice status updated"}

# WebSocket endpoint for real-time communication
@app.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    await manager.connect(websocket, user_id, room_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Handle different message types
            if message_data["type"] == "webrtc_offer":
                await manager.send_personal_message(
                    data, message_data["to_user"], room_id
                )
            elif message_data["type"] == "webrtc_answer":
                await manager.send_personal_message(
                    data, message_data["to_user"], room_id
                )
            elif message_data["type"] == "ice_candidate":
                await manager.send_personal_message(
                    data, message_data["to_user"], room_id
                )
            else:
                # Broadcast to all users in room
                await manager.broadcast_to_room(data, room_id, exclude_user=user_id)
                
    except WebSocketDisconnect:
        manager.disconnect(user_id, room_id)
        await manager.broadcast_to_room(
            json.dumps({
                "type": "user_disconnected",
                "user_id": user_id
            }),
            room_id
        )

# Health check
@api_router.get("/")
async def root():
    return {"message": "Free4Talk API is running"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Include router
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()