import React, { useState, useEffect, useRef, useContext, createContext } from 'react';
import { 
  UserIcon, 
  MicrophoneIcon, 
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  Cog6ToothIcon,
  HeartIcon,
  PhoneIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/outline';
import { MicrophoneIcon as MicrophoneSolid } from '@heroicons/react/24/solid';
import axios from 'axios';
import Peer from 'simple-peer';

const API_BASE = process.env.REACT_APP_BACKEND_URL + '/api';

// Auth Context
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
        } catch (error) {
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (email, username, password) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/register`, { email, username, password });
      const { access_token, user: userData } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await axios.post(`${API_BASE}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// WebRTC Hook with improved voice functionality
const useWebRTC = (roomId, userId, token, onRoomUpdate) => {
  const [peers, setPeers] = useState({});
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioPermissionGranted, setAudioPermissionGranted] = useState(false);
  const wsRef = useRef(null);
  const peersRef = useRef({});
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const speakingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!roomId || !userId || !token) return;

    const initWebRTC = async () => {
      try {
        console.log('Requesting audio permissions...');
        // Get user media with specific constraints
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }, 
          video: false 
        });
        
        setLocalStream(stream);
        setAudioPermissionGranted(true);
        console.log('Audio stream obtained successfully');

        // Set up voice activity detection
        setupVoiceActivityDetection(stream);

        // Connect to WebSocket
        const wsUrl = `${process.env.REACT_APP_BACKEND_URL.replace('https:', 'wss:').replace('http:', 'ws:')}/ws/${roomId}/${userId}`;
        console.log('Connecting to WebSocket:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          console.log('WebSocket connected successfully');
          
          // Send initial join message
          ws.send(JSON.stringify({
            type: 'user_joined',
            user_id: userId,
            room_id: roomId
          }));
        };

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          handleWebSocketMessage(message, stream);
        };

        ws.onclose = () => {
          setIsConnected(false);
          console.log('WebSocket disconnected');
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };

      } catch (error) {
        console.error('Error initializing WebRTC:', error);
        setAudioPermissionGranted(false);
        alert('Microphone access is required for voice chat. Please enable it and refresh the page.');
      }
    };

    initWebRTC();

    return () => {
      console.log('Cleaning up WebRTC...');
      // Cleanup
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(peer => {
        if (peer && peer.destroy) {
          peer.destroy();
        }
      });
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
      }
    };
  }, [roomId, userId, token]);

  const setupVoiceActivityDetection = (stream) => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const detectVoiceActivity = () => {
        if (!analyserRef.current) return;
        
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate volume level
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / bufferLength;
        const volumeLevel = average / 255;
        
        // Voice activity threshold
        const threshold = 0.01;
        const isSpeakingNow = volumeLevel > threshold && !isMuted;
        
        if (isSpeakingNow !== isSpeaking) {
          setIsSpeaking(isSpeakingNow);
          updateVoiceStatus(isSpeakingNow);
        }
        
        // Clear speaking timeout if still speaking
        if (isSpeakingNow) {
          if (speakingTimeoutRef.current) {
            clearTimeout(speakingTimeoutRef.current);
          }
          speakingTimeoutRef.current = setTimeout(() => {
            setIsSpeaking(false);
            updateVoiceStatus(false);
          }, 1000); // Stop speaking after 1 second of silence
        }
        
        requestAnimationFrame(detectVoiceActivity);
      };
      
      detectVoiceActivity();
    } catch (error) {
      console.error('Error setting up voice activity detection:', error);
    }
  };

  const updateVoiceStatus = async (speaking) => {
    if (!token || !roomId || !userId) return;
    
    try {
      await axios.post(`${API_BASE}/voice/status`, {
        room_id: roomId,
        user_id: userId,
        is_speaking: speaking,
        is_muted: isMuted
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error updating voice status:', error);
    }
  };

  const handleWebSocketMessage = (message, stream) => {
    console.log('Handling WebSocket message:', message.type);
    
    switch (message.type) {
      case 'user_joined':
        if (message.user && message.user.id !== userId) {
          console.log('User joined, creating peer connection:', message.user.id);
          createPeerConnection(message.user.id, true, stream);
        }
        if (onRoomUpdate) onRoomUpdate();
        break;
        
      case 'user_left':
        console.log('User left:', message.user_id);
        if (peersRef.current[message.user_id]) {
          peersRef.current[message.user_id].destroy();
          delete peersRef.current[message.user_id];
          setPeers(prev => {
            const newPeers = { ...prev };
            delete newPeers[message.user_id];
            return newPeers;
          });
        }
        if (onRoomUpdate) onRoomUpdate();
        break;
        
      case 'user_disconnected':
        console.log('User disconnected:', message.user_id);
        if (peersRef.current[message.user_id]) {
          peersRef.current[message.user_id].destroy();
          delete peersRef.current[message.user_id];
          setPeers(prev => {
            const newPeers = { ...prev };
            delete newPeers[message.user_id];
            return newPeers;
          });
        }
        if (onRoomUpdate) onRoomUpdate();
        break;
        
      case 'webrtc_offer':
        console.log('Received WebRTC offer from:', message.from_user);
        handleOffer(message.from_user, message.offer, stream);
        break;
        
      case 'webrtc_answer':
        console.log('Received WebRTC answer from:', message.from_user);
        handleAnswer(message.from_user, message.answer);
        break;
        
      case 'ice_candidate':
        console.log('Received ICE candidate from:', message.from_user);
        handleICECandidate(message.from_user, message.candidate);
        break;
        
      case 'voice_status_update':
        console.log('Voice status update:', message);
        if (onRoomUpdate) onRoomUpdate();
        break;
        
      default:
        console.log('Unknown message type:', message.type);
        break;
    }
  };

  const createPeerConnection = (targetUserId, initiator, stream) => {
    console.log(`Creating peer connection with ${targetUserId}, initiator: ${initiator}`);
    
    // Don't create duplicate connections
    if (peersRef.current[targetUserId]) {
      console.log('Peer connection already exists for:', targetUserId);
      return;
    }

    const peer = new Peer({
      initiator,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (signal) => {
      console.log(`Sending ${initiator ? 'offer' : 'answer'} to:`, targetUserId);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: initiator ? 'webrtc_offer' : 'webrtc_answer',
          to_user: targetUserId,
          from_user: userId,
          [initiator ? 'offer' : 'answer']: signal
        }));
      }
    });

    peer.on('stream', (remoteStream) => {
      console.log('Received remote stream from:', targetUserId);
      setPeers(prev => ({
        ...prev,
        [targetUserId]: { peer, stream: remoteStream, userId: targetUserId }
      }));
    });

    peer.on('connect', () => {
      console.log('Peer connected:', targetUserId);
    });

    peer.on('close', () => {
      console.log('Peer connection closed:', targetUserId);
      setPeers(prev => {
        const newPeers = { ...prev };
        delete newPeers[targetUserId];
        return newPeers;
      });
      delete peersRef.current[targetUserId];
    });

    peer.on('error', (error) => {
      console.error('Peer error:', error);
    });

    peersRef.current[targetUserId] = peer;
  };

  const handleOffer = (fromUserId, offer, stream) => {
    console.log('Handling offer from:', fromUserId);
    if (!peersRef.current[fromUserId]) {
      createPeerConnection(fromUserId, false, stream);
      setTimeout(() => {
        if (peersRef.current[fromUserId]) {
          peersRef.current[fromUserId].signal(offer);
        }
      }, 100);
    }
  };

  const handleAnswer = (fromUserId, answer) => {
    console.log('Handling answer from:', fromUserId);
    if (peersRef.current[fromUserId]) {
      peersRef.current[fromUserId].signal(answer);
    }
  };

  const handleICECandidate = (fromUserId, candidate) => {
    console.log('Handling ICE candidate from:', fromUserId);
    if (peersRef.current[fromUserId]) {
      peersRef.current[fromUserId].signal(candidate);
    }
  };

  const toggleMute = async () => {
    if (localStream) {
      const newMutedState = !isMuted;
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !newMutedState;
      });
      setIsMuted(newMutedState);
      
      // Update voice status when muting/unmuting
      try {
        await axios.post(`${API_BASE}/voice/status`, {
          room_id: roomId,
          user_id: userId,
          is_speaking: !newMutedState && isSpeaking,
          is_muted: newMutedState
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Error updating mute status:', error);
      }
    }
  };

  return {
    peers,
    localStream,
    isMuted,
    isConnected,
    isSpeaking,
    audioPermissionGranted,
    toggleMute
  };
};

// Language filter options
const languageFilters = [
  { name: 'All', count: 0, active: true },
  { name: 'English', count: 0 },
  { name: 'Hindi', count: 0 },
  { name: 'Indonesian', count: 0 },
  { name: 'Vietnamese', count: 0 },
  { name: 'Urdu', count: 0 },
  { name: 'Bengali', count: 0 },
  { name: 'Arabic', count: 0 },
  { name: 'Telugu', count: 0 },
  { name: 'Spanish', count: 0 },
  { name: 'Chinese', count: 0 },
  { name: 'Japanese', count: 0 },
  { name: 'Tamil', count: 0 }
];

// Header Component
export const Header = ({ darkMode, toggleDarkMode, onSignIn, onCreateRoom }) => {
  const { user, logout } = useAuth();

  return (
    <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="text-2xl font-bold text-blue-500">Free4Talk</div>
          </div>

          {/* Center Title */}
          <div className="hidden md:block">
            <h1 className={`text-xl font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Language Practice Community
            </h1>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors ${
                darkMode 
                  ? 'bg-slate-700 hover:bg-slate-600 text-yellow-400' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
            
            <button className="bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-lg font-medium transition-colors">
              ☕ Buy me a coffee
            </button>
            
            {user ? (
              <div className="flex items-center space-x-2">
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Hi, {user.username}
                </span>
                <button
                  onClick={logout}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Search and Controls Component
export const SearchControls = ({ darkMode, searchTerm, onSearchChange, onCreateRoom, rooms }) => {
  const [selectedFilters, setSelectedFilters] = useState(['All']);
  const { user } = useAuth();

  // Update language filter counts
  const updatedFilters = languageFilters.map(filter => {
    if (filter.name === 'All') {
      return { ...filter, count: rooms.length };
    }
    const count = rooms.filter(room => room.language.toLowerCase().includes(filter.name.toLowerCase())).length;
    return { ...filter, count };
  });

  const toggleFilter = (filterName) => {
    if (filterName === 'All') {
      setSelectedFilters(['All']);
    } else {
      const newFilters = selectedFilters.includes(filterName)
        ? selectedFilters.filter(f => f !== filterName)
        : [...selectedFilters.filter(f => f !== 'All'), filterName];
      
      setSelectedFilters(newFilters.length === 0 ? ['All'] : newFilters);
    }
  };

  return (
    <div className={`${darkMode ? 'bg-slate-800' : 'bg-white'} sticky top-0 z-10 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'} transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Action buttons */}
        <div className="flex items-center justify-center space-x-4 mb-4">
          {user && (
            <button
              onClick={onCreateRoom}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Create a new group</span>
            </button>
          )}
          
          <div className="flex items-center space-x-2">
            <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Privacy Policy</span>
            <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Is - Suggestions</span>
            <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Facebook Group</span>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              darkMode 
                ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
            placeholder="Search for Language, Level, Topic, Username, Mic On, Mic Off, Mic Allow, Full, Empty, Crowded, Unlimited..."
          />
        </div>

        {/* Language filters */}
        <div className="flex flex-wrap gap-2">
          {updatedFilters.map((filter) => (
            <button
              key={filter.name}
              onClick={() => toggleFilter(filter.name)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedFilters.includes(filter.name)
                  ? 'bg-blue-500 text-white'
                  : darkMode
                    ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.name} ({filter.count})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Chat Room Card Component
export const ChatRoomCard = ({ room, darkMode, onJoinRoom }) => {
  const { user } = useAuth();

  const renderUsers = () => {
    const maxDisplay = 4;
    const displayUsers = room.participants.slice(0, maxDisplay);
    const remainingCount = room.participants.length - maxDisplay;

    return (
      <div className="flex items-center justify-center space-x-2 mb-4 min-h-[80px]">
        {displayUsers.map((participant, index) => (
          <div key={participant.id} className="relative">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: getAvatarColor(participant.username) }}
            >
              {participant.avatar_url ? (
                <img 
                  src={participant.avatar_url} 
                  alt={participant.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                participant.username.substring(0, 2).toUpperCase()
              )}
            </div>
            {room.active_speakers.includes(participant.id) && (
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                <MicrophoneSolid className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
        ))}
        
        {remainingCount > 0 && (
          <div className="w-12 h-12 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-sm">
            +{remainingCount}
          </div>
        )}
      </div>
    );
  };

  const getAvatarColor = (username) => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
    const hash = username.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className={`rounded-lg p-6 transition-all duration-200 hover:scale-105 ${
      darkMode 
        ? 'bg-slate-700 hover:bg-slate-600 border border-slate-600' 
        : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm hover:shadow-md'
    }`}>
      {/* Language and level */}
      <div className="flex items-center space-x-2 mb-4">
        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
        <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
          {room.language}
        </span>
        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {room.level}
        </span>
      </div>

      {/* Room name if exists */}
      {room.name && (
        <div className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {room.name}
        </div>
      )}

      {/* Users */}
      {renderUsers()}

      {/* Action button */}
      <div className="text-center">
        {room.is_full ? (
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center justify-center space-x-1`}>
            <span>🔒</span>
            <span>This group is full</span>
          </div>
        ) : user ? (
          <button
            onClick={() => onJoinRoom(room)}
            className="text-blue-500 hover:text-blue-600 text-sm font-medium flex items-center justify-center space-x-1 transition-colors"
          >
            <MicrophoneIcon className="h-4 w-4" />
            <span>Join and talk now!</span>
          </button>
        ) : (
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Sign in to join
          </div>
        )}
      </div>
    </div>
  );
};

// Create Room Modal Component
export const CreateRoomModal = ({ isOpen, onClose, darkMode, onCreateRoom }) => {
  const [formData, setFormData] = useState({
    language: 'English',
    level: 'Any Level',
    name: '',
    max_users: 8,
    is_private: false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onCreateRoom(formData);
      onClose();
      setFormData({
        language: 'English',
        level: 'Any Level',
        name: '',
        max_users: 8,
        is_private: false
      });
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 w-full max-w-md mx-4 transition-colors duration-200`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Create New Room
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} transition-colors`}
          >
            <XMarkIcon className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Language
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({...formData, language: e.target.value})}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                darkMode 
                  ? 'bg-slate-700 border-slate-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
              <option>German</option>
              <option>Chinese</option>
              <option>Japanese</option>
              <option>Arabic</option>
              <option>Hindi</option>
              <option>Indonesian</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Level
            </label>
            <select
              value={formData.level}
              onChange={(e) => setFormData({...formData, level: e.target.value})}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                darkMode 
                  ? 'bg-slate-700 border-slate-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option>Any Level</option>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Upper Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Room Name (Optional)
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Enter room name"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                darkMode 
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Maximum Users
            </label>
            <select
              value={formData.max_users}
              onChange={(e) => setFormData({...formData, max_users: parseInt(e.target.value)})}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                darkMode 
                  ? 'bg-slate-700 border-slate-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value={4}>4 Users</option>
              <option value={6}>6 Users</option>
              <option value={8}>8 Users</option>
              <option value={12}>12 Users</option>
              <option value={20}>20 Users</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="private"
              checked={formData.is_private}
              onChange={(e) => setFormData({...formData, is_private: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="private" className={`ml-2 text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Private Room
            </label>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`flex-1 py-3 px-4 border rounded-lg font-medium transition-colors ${
                darkMode 
                  ? 'border-slate-600 text-gray-300 hover:bg-slate-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Sign In Modal Component  
export const SignInModal = ({ isOpen, onClose, darkMode }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        const result = await register(formData.email, formData.username, formData.password);
        if (result.success) {
          onClose();
        } else {
          setError(result.error);
        }
      } else {
        const result = await login(formData.email, formData.password);
        if (result.success) {
          onClose();
        } else {
          setError(result.error);
        }
      }
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 w-full max-w-md mx-4 transition-colors duration-200`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} transition-colors`}
          >
            <XMarkIcon className={`h-5 w-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                required
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  darkMode 
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter your username"
              />
            </div>
          )}

          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                darkMode 
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                darkMode 
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              placeholder="Enter your password"
            />
          </div>

          {isSignUp && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Confirm Password
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                required
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  darkMode 
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Confirm your password"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? (isSignUp ? 'Creating Account...' : 'Signing In...') : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className={`text-blue-500 hover:text-blue-600 text-sm transition-colors`}
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Room View Component (for when user joins a room)
export const RoomView = ({ room, onLeaveRoom, darkMode }) => {
  const { user, token } = useAuth();
  const [roomData, setRoomData] = useState(room);
  const [isLoading, setIsLoading] = useState(false);
  
  // Callback to refresh room data
  const refreshRoomData = async () => {
    if (!room.id || !token) return;
    
    try {
      const response = await axios.get(`${API_BASE}/rooms/${room.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRoomData(response.data);
    } catch (error) {
      console.error('Error refreshing room data:', error);
    }
  };

  const { peers, localStream, isMuted, isConnected, isSpeaking, audioPermissionGranted, toggleMute } = useWebRTC(
    room.id, 
    user?.id, 
    token, 
    refreshRoomData
  );

  useEffect(() => {
    // Join the room via API
    const joinRoom = async () => {
      if (!user || !token) return;
      
      setIsLoading(true);
      try {
        await axios.post(`${API_BASE}/rooms/${room.id}/join`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Refresh room data after joining
        await refreshRoomData();
      } catch (error) {
        console.error('Error joining room:', error);
      } finally {
        setIsLoading(false);
      }
    };

    joinRoom();
  }, [room.id, user, token]);

  // Refresh room data periodically
  useEffect(() => {
    const interval = setInterval(refreshRoomData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [room.id, token]);

  const handleLeaveRoom = async () => {
    setIsLoading(true);
    try {
      await axios.post(`${API_BASE}/rooms/${room.id}/leave`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onLeaveRoom();
    } catch (error) {
      console.error('Error leaving room:', error);
      onLeaveRoom();
    }
  };

  const getAvatarColor = (username) => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
    const hash = username.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const isUserSpeaking = (participantId) => {
    return roomData.active_speakers && roomData.active_speakers.includes(participantId);
  };

  if (!audioPermissionGranted) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-gray-50'} transition-colors duration-200`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className={`text-center p-8 rounded-lg ${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}`}>
            <MicrophoneIcon className="h-16 w-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-bold mb-2">Microphone Access Required</h2>
            <p className="mb-4">Please allow microphone access to join the voice chat.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-gray-50'} transition-colors duration-200`}>
      {/* Header */}
      <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLeaveRoom}
                disabled={isLoading}
                className={`text-sm ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors disabled:opacity-50`}
              >
                ← Back to Rooms
              </button>
              <div>
                <h1 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {roomData.language} - {roomData.level}
                  {roomData.name && <span className="text-sm ml-2">({roomData.name})</span>}
                </h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {roomData.participant_count} participant{roomData.participant_count !== 1 ? 's' : ''}
                  {roomData.max_users && ` • Max: ${roomData.max_users}`}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                isConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {isConnected ? 'Connected' : 'Connecting...'}
              </div>
              
              {isSpeaking && (
                <div className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Speaking
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Room Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Audio Permission Status */}
        {!isConnected && (
          <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border`}>
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                Connecting to voice chat...
              </span>
            </div>
          </div>
        )}

        {/* Participants Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
          {/* Other participants */}
          {roomData.participants && roomData.participants
            .filter(participant => participant.id !== user?.id)
            .map((participant) => (
            <div
              key={participant.id}
              className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 text-center transition-colors duration-200 border ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}
            >
              <div className="relative inline-block mb-3">
                <div 
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                    isUserSpeaking(participant.id) ? 'ring-4 ring-green-400 ring-opacity-75' : ''
                  }`}
                  style={{ backgroundColor: getAvatarColor(participant.username) }}
                >
                  {participant.avatar_url ? (
                    <img 
                      src={participant.avatar_url} 
                      alt={participant.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    participant.username.substring(0, 2).toUpperCase()
                  )}
                </div>
                {isUserSpeaking(participant.id) && (
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-2 animate-pulse">
                    <MicrophoneSolid className="h-4 w-4 text-white" />
                  </div>
                )}
                {participant.is_online && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                )}
              </div>
              <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {participant.username}
              </p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {isUserSpeaking(participant.id) ? 'Speaking' : 'Listening'}
              </p>
              
              {/* Audio element for peer streams */}
              {peers[participant.id] && (
                <audio
                  key={`audio-${participant.id}`}
                  ref={(audio) => {
                    if (audio && peers[participant.id] && peers[participant.id].stream) {
                      audio.srcObject = peers[participant.id].stream;
                      audio.volume = 1.0;
                      audio.play().catch(e => console.log('Audio play failed:', e));
                    }
                  }}
                  autoPlay
                  playsInline
                />
              )}
            </div>
          ))}

          {/* Current user */}
          <div className={`${darkMode ? 'bg-slate-800 border-blue-500' : 'bg-white border-blue-500'} border-2 rounded-lg p-6 text-center transition-colors duration-200`}>
            <div className="relative inline-block mb-3">
              <div 
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                  isSpeaking && !isMuted ? 'ring-4 ring-green-400 ring-opacity-75' : ''
                }`}
                style={{ backgroundColor: getAvatarColor(user?.username || 'You') }}
              >
                {user?.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt={user.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  (user?.username?.substring(0, 2) || 'ME').toUpperCase()
                )}
              </div>
              {isSpeaking && !isMuted && (
                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-2 animate-pulse">
                  <MicrophoneSolid className="h-4 w-4 text-white" />
                </div>
              )}
              {isMuted && (
                <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-2">
                  <SpeakerXMarkIcon className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
            <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              You ({user?.username})
            </p>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {isMuted ? 'Muted' : (isSpeaking ? 'Speaking' : 'Listening')}
            </p>
          </div>
        </div>

        {/* Voice Activity Visualization */}
        {localStream && (
          <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-white'} border ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Voice Activity
              </span>
              <div className={`flex items-center space-x-2 ${isSpeaking ? 'text-green-500' : 'text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-sm">
                  {isSpeaking ? 'Speaking' : 'Silent'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={toggleMute}
            disabled={!localStream}
            className={`p-4 rounded-full transition-colors disabled:opacity-50 ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <SpeakerXMarkIcon className="h-6 w-6" />
            ) : (
              <MicrophoneIcon className="h-6 w-6" />
            )}
          </button>
          
          <div className="flex flex-col items-center space-y-2">
            <button
              onClick={handleLeaveRoom}
              disabled={isLoading}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Leaving...' : 'Leave Room'}
            </button>
            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Press and hold to speak clearly
            </span>
          </div>
        </div>

        {/* Debug Info (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h3 className="font-bold mb-2">Debug Info:</h3>
            <div className="text-xs space-y-1">
              <div>Connected Peers: {Object.keys(peers).length}</div>
              <div>Local Stream: {localStream ? 'Active' : 'None'}</div>
              <div>WebSocket: {isConnected ? 'Connected' : 'Disconnected'}</div>
              <div>Speaking: {isSpeaking ? 'Yes' : 'No'}</div>
              <div>Muted: {isMuted ? 'Yes' : 'No'}</div>
              <div>Room Participants: {roomData.participant_count}</div>
              <div>Active Speakers: {roomData.active_speakers?.length || 0}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Utility function for avatar colors
const getAvatarColor = (username) => {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
  const hash = username.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Main Free4Talk Component
export const Free4Talk = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, token } = useAuth();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await axios.get(`${API_BASE}/rooms`);
      setRooms(response.data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.level.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (room.name && room.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateRoom = async (roomData) => {
    try {
      const response = await axios.post(`${API_BASE}/rooms`, roomData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRooms([response.data, ...rooms]);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  };

  const handleJoinRoom = async (room) => {
    if (!user) {
      setShowSignInModal(true);
      return;
    }

    setCurrentRoom(room);
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    fetchRooms(); // Refresh rooms list
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className={`mt-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading rooms...</p>
        </div>
      </div>
    );
  }

  if (currentRoom) {
    return (
      <RoomView 
        room={currentRoom} 
        onLeaveRoom={handleLeaveRoom} 
        darkMode={darkMode}
      />
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      darkMode ? 'bg-slate-900' : 'bg-gray-50'
    }`}>
      <Header 
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(!darkMode)}
        onSignIn={() => setShowSignInModal(true)}
        onCreateRoom={() => setShowCreateModal(true)}
      />
      
      <SearchControls
        darkMode={darkMode}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onCreateRoom={() => setShowCreateModal(true)}
        rooms={rooms}
      />

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredRooms.length === 0 ? (
          <div className="text-center py-12">
            <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              No rooms found. {user ? 'Create the first one!' : 'Sign in to create a room!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => (
              <ChatRoomCard
                key={room.id}
                room={room}
                darkMode={darkMode}
                onJoinRoom={handleJoinRoom}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {user && (
        <CreateRoomModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          darkMode={darkMode}
          onCreateRoom={handleCreateRoom}
        />
      )}

      <SignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        darkMode={darkMode}
      />
    </div>
  );
};

// Wrap the main component with AuthProvider
export const AppWithAuth = () => (
  <AuthProvider>
    <Free4Talk />
  </AuthProvider>
);