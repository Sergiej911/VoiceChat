#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Free4Talk
Tests all backend endpoints with realistic data
"""

import requests
import json
import time
import uuid
from datetime import datetime
from typing import Dict, Optional

# Configuration
BASE_URL = "https://ade62507-08af-420e-a70d-c06aab1e8348.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class Free4TalkAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = HEADERS.copy()
        self.auth_token = None
        self.test_user_data = {
            "email": "sarah.johnson@example.com",
            "username": "sarah_speaks_french",
            "password": "SecurePass123!"
        }
        self.test_room_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Dict = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, auth_required: bool = False) -> requests.Response:
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = self.headers.copy()
        
        if auth_required and self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=10)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=10)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=headers, json=data, timeout=10)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            raise

    def test_health_endpoints(self):
        """Test health check endpoints"""
        print("\n=== Testing Health Check Endpoints ===")
        
        # Test GET /api/
        try:
            response = self.make_request("GET", "/")
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "Free4Talk" in data["message"]:
                    self.log_test("Health Check Root", True, f"API root accessible: {data['message']}", data)
                else:
                    self.log_test("Health Check Root", False, f"Unexpected response format: {data}")
            else:
                self.log_test("Health Check Root", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Health Check Root", False, f"Exception: {str(e)}")
            
        # Test GET /api/health
        try:
            response = self.make_request("GET", "/health")
            if response.status_code == 200:
                data = response.json()
                if "status" in data and data["status"] == "healthy":
                    self.log_test("Health Check Endpoint", True, f"Health status: {data['status']}", data)
                else:
                    self.log_test("Health Check Endpoint", False, f"Unexpected health status: {data}")
            else:
                self.log_test("Health Check Endpoint", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Health Check Endpoint", False, f"Exception: {str(e)}")

    def test_user_registration(self):
        """Test user registration"""
        print("\n=== Testing User Registration ===")
        
        try:
            response = self.make_request("POST", "/auth/register", self.test_user_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.auth_token = data["access_token"]
                    user_info = data["user"]
                    self.log_test("User Registration", True, 
                                f"User registered successfully: {user_info['username']} ({user_info['email']})", data)
                else:
                    self.log_test("User Registration", False, f"Missing required fields in response: {data}")
            elif response.status_code == 400:
                # User might already exist, try to login instead
                self.log_test("User Registration", True, "User already exists (expected for repeated tests)", response.json())
                return self.test_user_login()
            else:
                self.log_test("User Registration", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("User Registration", False, f"Exception: {str(e)}")

    def test_user_login(self):
        """Test user login"""
        print("\n=== Testing User Login ===")
        
        login_data = {
            "email": self.test_user_data["email"],
            "password": self.test_user_data["password"]
        }
        
        try:
            response = self.make_request("POST", "/auth/login", login_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.auth_token = data["access_token"]
                    user_info = data["user"]
                    self.log_test("User Login", True, 
                                f"Login successful: {user_info['username']} ({user_info['email']})", data)
                else:
                    self.log_test("User Login", False, f"Missing required fields in response: {data}")
            else:
                self.log_test("User Login", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("User Login", False, f"Exception: {str(e)}")

    def test_get_current_user(self):
        """Test getting current user info"""
        print("\n=== Testing Get Current User ===")
        
        if not self.auth_token:
            self.log_test("Get Current User", False, "No auth token available")
            return
            
        try:
            response = self.make_request("GET", "/auth/me", auth_required=True)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "email" in data and "username" in data:
                    self.log_test("Get Current User", True, 
                                f"User info retrieved: {data['username']} ({data['email']})", data)
                else:
                    self.log_test("Get Current User", False, f"Missing required fields in response: {data}")
            else:
                self.log_test("Get Current User", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Get Current User", False, f"Exception: {str(e)}")

    def test_get_rooms(self):
        """Test getting all rooms"""
        print("\n=== Testing Get All Rooms ===")
        
        try:
            response = self.make_request("GET", "/rooms")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get All Rooms", True, f"Retrieved {len(data)} rooms", {"room_count": len(data)})
                else:
                    self.log_test("Get All Rooms", False, f"Expected list, got: {type(data)}")
            else:
                self.log_test("Get All Rooms", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Get All Rooms", False, f"Exception: {str(e)}")

    def test_create_room(self):
        """Test creating a new room"""
        print("\n=== Testing Create Room ===")
        
        if not self.auth_token:
            self.log_test("Create Room", False, "No auth token available")
            return
            
        room_data = {
            "name": "French Conversation Circle",
            "language": "French",
            "level": "Intermediate",
            "max_users": 6,
            "is_private": False
        }
        
        try:
            response = self.make_request("POST", "/rooms", room_data, auth_required=True)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "name" in data and "language" in data:
                    self.test_room_id = data["id"]
                    self.log_test("Create Room", True, 
                                f"Room created: {data['name']} (ID: {data['id']})", data)
                else:
                    self.log_test("Create Room", False, f"Missing required fields in response: {data}")
            else:
                self.log_test("Create Room", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Create Room", False, f"Exception: {str(e)}")

    def test_join_room(self):
        """Test joining a room"""
        print("\n=== Testing Join Room ===")
        
        if not self.auth_token:
            self.log_test("Join Room", False, "No auth token available")
            return
            
        if not self.test_room_id:
            self.log_test("Join Room", False, "No room ID available")
            return
            
        try:
            response = self.make_request("POST", f"/rooms/{self.test_room_id}/join", auth_required=True)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_test("Join Room", True, f"Joined room successfully: {data['message']}", data)
                else:
                    self.log_test("Join Room", False, f"Unexpected response format: {data}")
            else:
                self.log_test("Join Room", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Join Room", False, f"Exception: {str(e)}")

    def test_get_specific_room(self):
        """Test getting a specific room"""
        print("\n=== Testing Get Specific Room ===")
        
        if not self.test_room_id:
            self.log_test("Get Specific Room", False, "No room ID available")
            return
            
        try:
            response = self.make_request("GET", f"/rooms/{self.test_room_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "participants" in data:
                    self.log_test("Get Specific Room", True, 
                                f"Room details retrieved: {data.get('name', 'Unnamed')} with {data['participant_count']} participants", data)
                else:
                    self.log_test("Get Specific Room", False, f"Missing required fields in response: {data}")
            else:
                self.log_test("Get Specific Room", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Get Specific Room", False, f"Exception: {str(e)}")

    def test_webrtc_endpoints(self):
        """Test WebRTC signaling endpoints"""
        print("\n=== Testing WebRTC Signaling Endpoints ===")
        
        if not self.auth_token:
            self.log_test("WebRTC Endpoints", False, "No auth token available")
            return
            
        if not self.test_room_id:
            self.log_test("WebRTC Endpoints", False, "No room ID available")
            return
            
        # Test WebRTC Offer
        offer_data = {
            "room_id": self.test_room_id,
            "from_user": "user123",
            "to_user": "user456",
            "offer": {
                "type": "offer",
                "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"
            }
        }
        
        try:
            response = self.make_request("POST", "/webrtc/offer", offer_data, auth_required=True)
            if response.status_code == 200:
                data = response.json()
                self.log_test("WebRTC Offer", True, f"Offer sent: {data.get('message', 'Success')}", data)
            else:
                self.log_test("WebRTC Offer", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("WebRTC Offer", False, f"Exception: {str(e)}")
            
        # Test WebRTC Answer
        answer_data = {
            "room_id": self.test_room_id,
            "from_user": "user456",
            "to_user": "user123",
            "answer": {
                "type": "answer",
                "sdp": "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"
            }
        }
        
        try:
            response = self.make_request("POST", "/webrtc/answer", answer_data, auth_required=True)
            if response.status_code == 200:
                data = response.json()
                self.log_test("WebRTC Answer", True, f"Answer sent: {data.get('message', 'Success')}", data)
            else:
                self.log_test("WebRTC Answer", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("WebRTC Answer", False, f"Exception: {str(e)}")
            
        # Test ICE Candidate
        ice_data = {
            "room_id": self.test_room_id,
            "from_user": "user123",
            "to_user": "user456",
            "candidate": {
                "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host",
                "sdpMLineIndex": 0,
                "sdpMid": "audio"
            }
        }
        
        try:
            response = self.make_request("POST", "/webrtc/ice-candidate", ice_data, auth_required=True)
            if response.status_code == 200:
                data = response.json()
                self.log_test("WebRTC ICE Candidate", True, f"ICE candidate sent: {data.get('message', 'Success')}", data)
            else:
                self.log_test("WebRTC ICE Candidate", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("WebRTC ICE Candidate", False, f"Exception: {str(e)}")

    def test_voice_status(self):
        """Test voice status endpoint"""
        print("\n=== Testing Voice Status ===")
        
        if not self.auth_token:
            self.log_test("Voice Status", False, "No auth token available")
            return
            
        if not self.test_room_id:
            self.log_test("Voice Status", False, "No room ID available")
            return
            
        voice_data = {
            "room_id": self.test_room_id,
            "user_id": "user123",
            "is_speaking": True,
            "is_muted": False
        }
        
        try:
            response = self.make_request("POST", "/voice/status", voice_data, auth_required=True)
            if response.status_code == 200:
                data = response.json()
                self.log_test("Voice Status", True, f"Voice status updated: {data.get('message', 'Success')}", data)
            else:
                self.log_test("Voice Status", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Voice Status", False, f"Exception: {str(e)}")

    def test_leave_room(self):
        """Test leaving a room"""
        print("\n=== Testing Leave Room ===")
        
        if not self.auth_token:
            self.log_test("Leave Room", False, "No auth token available")
            return
            
        if not self.test_room_id:
            self.log_test("Leave Room", False, "No room ID available")
            return
            
        try:
            response = self.make_request("POST", f"/rooms/{self.test_room_id}/leave", auth_required=True)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_test("Leave Room", True, f"Left room successfully: {data['message']}", data)
                else:
                    self.log_test("Leave Room", False, f"Unexpected response format: {data}")
            else:
                self.log_test("Leave Room", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Leave Room", False, f"Exception: {str(e)}")

    def test_logout(self):
        """Test user logout"""
        print("\n=== Testing User Logout ===")
        
        if not self.auth_token:
            self.log_test("User Logout", False, "No auth token available")
            return
            
        try:
            response = self.make_request("POST", "/auth/logout", auth_required=True)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_test("User Logout", True, f"Logout successful: {data['message']}", data)
                    self.auth_token = None  # Clear token
                else:
                    self.log_test("User Logout", False, f"Unexpected response format: {data}")
            else:
                self.log_test("User Logout", False, f"Status code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("User Logout", False, f"Exception: {str(e)}")

    def test_error_cases(self):
        """Test error handling"""
        print("\n=== Testing Error Cases ===")
        
        # Test invalid login
        invalid_login = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        
        try:
            response = self.make_request("POST", "/auth/login", invalid_login)
            if response.status_code == 401:
                self.log_test("Invalid Login Error", True, "Correctly rejected invalid credentials")
            else:
                self.log_test("Invalid Login Error", False, f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_test("Invalid Login Error", False, f"Exception: {str(e)}")
            
        # Test accessing protected endpoint without auth
        try:
            response = self.make_request("GET", "/auth/me")
            if response.status_code == 403:
                self.log_test("Unauthorized Access Error", True, "Correctly rejected unauthorized access")
            else:
                self.log_test("Unauthorized Access Error", False, f"Expected 403, got {response.status_code}")
        except Exception as e:
            self.log_test("Unauthorized Access Error", False, f"Exception: {str(e)}")
            
        # Test non-existent room
        try:
            response = self.make_request("GET", "/rooms/nonexistent-room-id")
            if response.status_code == 404:
                self.log_test("Non-existent Room Error", True, "Correctly returned 404 for non-existent room")
            else:
                self.log_test("Non-existent Room Error", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Non-existent Room Error", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"🚀 Starting Free4Talk Backend API Tests")
        print(f"📡 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Health checks first
        self.test_health_endpoints()
        
        # Authentication flow
        self.test_user_registration()
        if not self.auth_token:
            self.test_user_login()
        self.test_get_current_user()
        
        # Room management
        self.test_get_rooms()
        self.test_create_room()
        self.test_join_room()
        self.test_get_specific_room()
        
        # WebRTC and voice
        self.test_webrtc_endpoints()
        self.test_voice_status()
        
        # Cleanup
        self.test_leave_room()
        self.test_logout()
        
        # Error cases
        self.test_error_cases()
        
        # Summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n✅ All tests completed!")

if __name__ == "__main__":
    tester = Free4TalkAPITester()
    tester.run_all_tests()