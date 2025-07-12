import React, { useState, useEffect } from 'react';
import { 
  UserIcon, 
  MicrophoneIcon, 
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  Cog6ToothIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import { MicrophoneIcon as MicrophoneSolid } from '@heroicons/react/24/solid';

// Mock data for chat rooms
const mockRooms = [
  {
    id: 1,
    language: 'Arabic',
    level: 'Advanced',
    users: [
      { id: 1, initials: 'MU', name: 'Muhammad', status: 'speaking', color: '#10B981' }
    ],
    participantCount: 1,
    maxUsers: 8,
    isFull: false
  },
  {
    id: 2,
    language: 'English',
    level: 'Any Level',
    users: [
      { id: 2, initials: 'HA', name: 'Hassan', status: 'listening', color: '#3B82F6' },
      { id: 3, initials: 'KK', name: 'Karen', status: 'listening', color: '#6B7280' }
    ],
    participantCount: 2,
    maxUsers: 8,
    isFull: false
  },
  {
    id: 3,
    language: 'English',
    level: 'Upper Intermediate',
    users: [],
    participantCount: 0,
    maxUsers: 8,
    isFull: false
  },
  {
    id: 4,
    language: 'English',
    level: 'Any Level',
    users: [
      { id: 4, initials: 'NN', name: 'Nina', status: 'speaking', color: '#F59E0B' }
    ],
    participantCount: 1,
    maxUsers: 8,
    isFull: true
  },
  {
    id: 5,
    language: 'Hindi + English',
    level: 'Any Level',
    users: [
      { id: 5, initials: 'NN', name: 'Neha', status: 'speaking', color: '#8B5CF6' }
    ],
    participantCount: 1,
    maxUsers: 8,
    isFull: false
  },
  {
    id: 6,
    language: 'English',
    level: 'Intermediate',
    users: [
      { id: 6, initials: 'SM', name: 'Sarah', status: 'speaking', color: '#DC2626', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612e0a8?w=150&h=150&fit=crop&crop=face' },
      { id: 7, initials: 'EM', name: 'Emma', status: 'listening', color: '#059669' }
    ],
    participantCount: 2,
    maxUsers: 8,
    isFull: false
  },
  {
    id: 7,
    language: 'Indonesian',
    level: 'Any Level',
    users: [
      { id: 8, initials: 'SG', name: 'Sari', status: 'speaking', color: '#7C3AED' }
    ],
    participantCount: 1,
    maxUsers: 8,
    isFull: true
  },
  {
    id: 8,
    language: 'English',
    level: 'Any Level',
    users: [
      { id: 9, initials: 'AA', name: 'Ahmed', status: 'speaking', color: '#EC4899' }
    ],
    participantCount: 1,
    maxUsers: 8,
    isFull: false
  }
];

// Language filter options
const languageFilters = [
  { name: 'All', count: 306, active: true },
  { name: 'English', count: 200 },
  { name: 'Hindi', count: 54 },
  { name: 'Indonesian', count: 35 },
  { name: 'Vietnamese', count: 28 },
  { name: 'Urdu', count: 22 },
  { name: 'Bengali', count: 21 },
  { name: 'Arabic', count: 17 },
  { name: 'Telugu', count: 10 },
  { name: 'Spanish', count: 7 },
  { name: 'Chinese', count: 6 },
  { name: 'Japanese', count: 4 },
  { name: 'Tamil', count: 3 }
];

// Header Component
export const Header = ({ darkMode, toggleDarkMode, onSignIn, onCreateRoom }) => {
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

          {/* Right side buttons */}
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
            
            <button
              onClick={onSignIn}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Search and Controls Component
export const SearchControls = ({ darkMode, searchTerm, onSearchChange, onCreateRoom }) => {
  const [selectedFilters, setSelectedFilters] = useState(['All']);

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
          <button
            onClick={onCreateRoom}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Create a new group</span>
          </button>
          
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
          {languageFilters.map((filter) => (
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
  const renderUsers = () => {
    const maxDisplay = 4;
    const displayUsers = room.users.slice(0, maxDisplay);
    const remainingCount = room.users.length - maxDisplay;

    return (
      <div className="flex items-center justify-center space-x-2 mb-4 min-h-[80px]">
        {displayUsers.map((user, index) => (
          <div key={user.id} className="relative">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: user.color }}
            >
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                user.initials
              )}
            </div>
            {user.status === 'speaking' && (
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

      {/* Users */}
      {renderUsers()}

      {/* Action button */}
      <div className="text-center">
        {room.isFull ? (
          <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} flex items-center justify-center space-x-1`}>
            <span>🔒</span>
            <span>This group is full</span>
          </div>
        ) : (
          <button
            onClick={() => onJoinRoom(room)}
            className="text-blue-500 hover:text-blue-600 text-sm font-medium flex items-center justify-center space-x-1 transition-colors"
          >
            <MicrophoneIcon className="h-4 w-4" />
            <span>Join and talk now!</span>
          </button>
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
    roomName: '',
    maxUsers: 8,
    isPrivate: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateRoom(formData);
    onClose();
    setFormData({
      language: 'English',
      level: 'Any Level',
      roomName: '',
      maxUsers: 8,
      isPrivate: false
    });
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
              value={formData.roomName}
              onChange={(e) => setFormData({...formData, roomName: e.target.value})}
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
              value={formData.maxUsers}
              onChange={(e) => setFormData({...formData, maxUsers: parseInt(e.target.value)})}
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
              checked={formData.isPrivate}
              onChange={(e) => setFormData({...formData, isPrivate: e.target.checked})}
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
              className="flex-1 py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              Create Room
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

  const handleSubmit = (e) => {
    e.preventDefault();
    // Mock authentication
    console.log(isSignUp ? 'Sign up' : 'Sign in', formData);
    onClose();
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
            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            {isSignUp ? 'Create Account' : 'Sign In'}
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
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-gray-50'} transition-colors duration-200`}>
      {/* Header */}
      <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={onLeaveRoom}
                className={`text-sm ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
              >
                ← Back to Rooms
              </button>
              <div>
                <h1 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {room.language} - {room.level}
                </h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {room.participantCount} participants
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                isConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Room Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Participants Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
          {room.users.map((user) => (
            <div
              key={user.id}
              className={`${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 text-center transition-colors duration-200 border ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}
            >
              <div className="relative inline-block mb-3">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: user.color }}
                >
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    user.initials
                  )}
                </div>
                {user.status === 'speaking' && (
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-2">
                    <MicrophoneSolid className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {user.name}
              </p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {user.status === 'speaking' ? 'Speaking' : 'Listening'}
              </p>
            </div>
          ))}

          {/* Current user */}
          <div className={`${darkMode ? 'bg-slate-800 border-blue-500' : 'bg-white border-blue-500'} border-2 rounded-lg p-6 text-center transition-colors duration-200`}>
            <div className="relative inline-block mb-3">
              <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
                ME
              </div>
              {!isMuted && (
                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-2">
                  <MicrophoneSolid className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
            <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              You
            </p>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {isMuted ? 'Muted' : 'Speaking'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-4 rounded-full transition-colors ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            <MicrophoneIcon className="h-6 w-6" />
          </button>
          
          <button
            onClick={onLeaveRoom}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Free4Talk Component
export const Free4Talk = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [rooms, setRooms] = useState(mockRooms);

  const filteredRooms = rooms.filter(room =>
    room.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.level.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateRoom = (roomData) => {
    const newRoom = {
      id: rooms.length + 1,
      language: roomData.language,
      level: roomData.level,
      users: [],
      participantCount: 0,
      maxUsers: roomData.maxUsers,
      isFull: false,
      name: roomData.roomName
    };
    setRooms([...rooms, newRoom]);
  };

  const handleJoinRoom = (room) => {
    setCurrentRoom(room);
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
  };

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
      />

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      </div>

      {/* Modals */}
      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        darkMode={darkMode}
        onCreateRoom={handleCreateRoom}
      />

      <SignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        darkMode={darkMode}
      />
    </div>
  );
};