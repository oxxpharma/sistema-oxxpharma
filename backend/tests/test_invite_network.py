"""
MLM Vanguard System - Invite and Network Page Tests
Tests for:
- POST /api/invites/send - Send invite to become a reseller
- GET /api/invites/sent - List sent invites
- GET /api/network/tree - Network tree structure
- GET /api/network/stats - Network statistics
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://oxx-franchise-system.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@vanguard.com"
ADMIN_PASSWORD = "admin123"
RESELLER_EMAIL = "revendedor@teste.com"
RESELLER_PASSWORD = "teste123"


class TestResellerSetup:
    """Ensure reseller test user exists"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if res.status_code == 200:
            return res.json().get("token")
        pytest.skip("Admin login failed")
    
    def test_create_reseller_if_not_exists(self, admin_token):
        """Create revendedor@teste.com if it doesn't exist"""
        # Try to login first
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": RESELLER_EMAIL,
            "password": RESELLER_PASSWORD
        })
        
        if res.status_code == 200:
            print(f"✅ Reseller user already exists")
            return
        
        # Create the reseller
        res = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": RESELLER_EMAIL,
            "password": RESELLER_PASSWORD,
            "name": "Revendedor Teste",
            "phone": "11999999999",
            "access_level": 4  # Reseller
        })
        
        assert res.status_code == 200, f"Failed to create reseller: {res.text}"
        print(f"✅ Created reseller user: {RESELLER_EMAIL}")


class TestInvitesAPI:
    """Test invite endpoints for resellers"""
    
    @pytest.fixture
    def reseller_token(self):
        """Get reseller token"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": RESELLER_EMAIL,
            "password": RESELLER_PASSWORD
        })
        if res.status_code == 200:
            return res.json().get("token")
        pytest.skip("Reseller login failed")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if res.status_code == 200:
            return res.json().get("token")
        pytest.skip("Admin login failed")
    
    def test_send_invite_as_reseller(self, reseller_token):
        """Test POST /api/invites/send creates a new invite"""
        unique_email = f"test_invite_{uuid.uuid4().hex[:8]}@example.com"
        
        res = requests.post(f"{BASE_URL}/api/invites/send", json={
            "email": unique_email,
            "name": "Test Invite User",
            "type": "reseller"
        }, headers={
            "Authorization": f"Bearer {reseller_token}"
        })
        
        assert res.status_code == 200, f"Send invite failed: {res.text}"
        data = res.json()
        
        assert "message" in data
        assert "invite_id" in data
        assert data["message"] == "Convite enviado com sucesso"
        
        print(f"✅ Invite sent successfully: {data['invite_id']}")
    
    def test_send_invite_duplicate_email_fails(self, reseller_token):
        """Test sending invite to same email twice fails"""
        unique_email = f"test_dup_{uuid.uuid4().hex[:8]}@example.com"
        
        # First invite
        res = requests.post(f"{BASE_URL}/api/invites/send", json={
            "email": unique_email,
            "name": "First Invite",
            "type": "reseller"
        }, headers={
            "Authorization": f"Bearer {reseller_token}"
        })
        assert res.status_code == 200
        
        # Second invite to same email
        res = requests.post(f"{BASE_URL}/api/invites/send", json={
            "email": unique_email,
            "name": "Second Invite",
            "type": "reseller"
        }, headers={
            "Authorization": f"Bearer {reseller_token}"
        })
        
        assert res.status_code == 400, f"Duplicate invite should fail, got: {res.status_code}"
        data = res.json()
        assert "pendente" in data.get("detail", "").lower() or "existe" in data.get("detail", "").lower()
        
        print(f"✅ Duplicate invite correctly rejected: {data.get('detail')}")
    
    def test_send_invite_to_existing_user_fails(self, reseller_token):
        """Test sending invite to existing user email fails"""
        res = requests.post(f"{BASE_URL}/api/invites/send", json={
            "email": ADMIN_EMAIL,  # Already exists
            "name": "Admin User",
            "type": "reseller"
        }, headers={
            "Authorization": f"Bearer {reseller_token}"
        })
        
        assert res.status_code == 400
        data = res.json()
        assert "cadastrado" in data.get("detail", "").lower()
        
        print(f"✅ Invite to existing user correctly rejected")
    
    def test_send_invite_requires_auth(self):
        """Test /api/invites/send requires authentication"""
        res = requests.post(f"{BASE_URL}/api/invites/send", json={
            "email": "test@example.com",
            "name": "Test",
            "type": "reseller"
        })
        
        assert res.status_code == 401
        print(f"✅ /api/invites/send correctly requires authentication")
    
    def test_send_invite_as_admin_fails(self, admin_token):
        """Test that admin (access_level 0) cannot send reseller invites"""
        res = requests.post(f"{BASE_URL}/api/invites/send", json={
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "name": "Test User",
            "type": "reseller"
        }, headers={
            "Authorization": f"Bearer {admin_token}"
        })
        
        # Admin (level 0) should not be able to invite resellers (only levels 3 and 4 can)
        assert res.status_code == 403
        print(f"✅ Admin correctly cannot send reseller invites (only resellers/leaders can)")
    
    def test_get_sent_invites(self, reseller_token):
        """Test GET /api/invites/sent returns list of sent invites"""
        res = requests.get(f"{BASE_URL}/api/invites/sent", headers={
            "Authorization": f"Bearer {reseller_token}"
        })
        
        assert res.status_code == 200, f"Get sent invites failed: {res.text}"
        data = res.json()
        
        assert "invites" in data
        assert isinstance(data["invites"], list)
        
        # If there are invites, verify structure
        if len(data["invites"]) > 0:
            invite = data["invites"][0]
            assert "invite_id" in invite
            assert "email" in invite
            assert "name" in invite
            assert "status" in invite
            assert "created_at" in invite
        
        print(f"✅ Got {len(data['invites'])} sent invites")
    
    def test_get_sent_invites_requires_auth(self):
        """Test /api/invites/sent requires authentication"""
        res = requests.get(f"{BASE_URL}/api/invites/sent")
        
        assert res.status_code == 401
        print(f"✅ /api/invites/sent correctly requires authentication")


class TestNetworkAPI:
    """Test network tree and stats endpoints"""
    
    @pytest.fixture
    def reseller_token(self):
        """Get reseller token"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": RESELLER_EMAIL,
            "password": RESELLER_PASSWORD
        })
        if res.status_code == 200:
            return res.json().get("token")
        pytest.skip("Reseller login failed")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if res.status_code == 200:
            return res.json().get("token")
        pytest.skip("Admin login failed")
    
    def test_get_network_tree_as_reseller(self, reseller_token):
        """Test GET /api/network/tree returns tree structure"""
        res = requests.get(f"{BASE_URL}/api/network/tree", headers={
            "Authorization": f"Bearer {reseller_token}"
        })
        
        assert res.status_code == 200, f"Get network tree failed: {res.text}"
        data = res.json()
        
        assert "tree" in data
        assert isinstance(data["tree"], list)
        
        # If there are nodes, verify structure
        if len(data["tree"]) > 0:
            node = data["tree"][0]
            assert "user_id" in node
            assert "name" in node
            assert "email" in node
            assert "status" in node
        
        print(f"✅ Network tree has {len(data['tree'])} root nodes")
    
    def test_get_network_tree_as_admin(self, admin_token):
        """Test admin sees full network tree"""
        res = requests.get(f"{BASE_URL}/api/network/tree", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        
        assert res.status_code == 200, f"Get network tree failed: {res.text}"
        data = res.json()
        
        assert "tree" in data
        print(f"✅ Admin network tree has {len(data['tree'])} root nodes")
    
    def test_get_network_tree_requires_auth(self):
        """Test /api/network/tree requires authentication"""
        res = requests.get(f"{BASE_URL}/api/network/tree")
        
        assert res.status_code == 401
        print(f"✅ /api/network/tree correctly requires authentication")
    
    def test_get_network_stats_as_reseller(self, reseller_token):
        """Test GET /api/network/stats returns statistics"""
        res = requests.get(f"{BASE_URL}/api/network/stats", headers={
            "Authorization": f"Bearer {reseller_token}"
        })
        
        assert res.status_code == 200, f"Get network stats failed: {res.text}"
        data = res.json()
        
        # Verify response structure
        assert "total_network" in data
        assert "level_1" in data
        assert "level_2" in data
        assert "level_3" in data
        assert "active_this_month" in data
        
        # Verify data types
        assert isinstance(data["total_network"], int)
        assert isinstance(data["level_1"], int)
        assert isinstance(data["level_2"], int)
        assert isinstance(data["level_3"], int)
        assert isinstance(data["active_this_month"], int)
        
        print(f"✅ Network stats: total={data['total_network']}, L1={data['level_1']}, L2={data['level_2']}, L3={data['level_3']}")
    
    def test_get_network_stats_requires_auth(self):
        """Test /api/network/stats requires authentication"""
        res = requests.get(f"{BASE_URL}/api/network/stats")
        
        assert res.status_code == 401
        print(f"✅ /api/network/stats correctly requires authentication")


class TestAccessControl:
    """Test access level restrictions"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if res.status_code == 200:
            return res.json().get("token")
        pytest.skip("Admin login failed")
    
    def test_create_client_user_and_check_network_access(self, admin_token):
        """Test that client (access_level 5) cannot access network pages"""
        # Create a client user
        unique_email = f"test_client_{uuid.uuid4().hex[:8]}@example.com"
        
        res = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "teste123",
            "name": "Test Client",
            "access_level": 5  # Client
        })
        
        assert res.status_code == 200, f"Create client failed: {res.text}"
        client_token = res.json().get("token")
        
        # Try to access network tree
        res = requests.get(f"{BASE_URL}/api/network/tree", headers={
            "Authorization": f"Bearer {client_token}"
        })
        
        # Network tree should still return data for the user (even if empty)
        assert res.status_code == 200
        
        # Try to send invite (should fail - only resellers/leaders can)
        res = requests.post(f"{BASE_URL}/api/invites/send", json={
            "email": f"invited_{uuid.uuid4().hex[:8]}@example.com",
            "name": "Test Invite",
            "type": "reseller"
        }, headers={
            "Authorization": f"Bearer {client_token}"
        })
        
        assert res.status_code == 403, f"Client should not be able to send invites, got: {res.status_code}"
        
        print(f"✅ Client user access correctly restricted")


class TestRegressionExistingEndpoints:
    """Regression tests for existing endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if res.status_code == 200:
            return res.json().get("token")
        pytest.skip("Admin login failed")
    
    def test_health_check(self):
        """Test health endpoint"""
        res = requests.get(f"{BASE_URL}/api/health")
        assert res.status_code == 200
        print(f"✅ Health check passed")
    
    def test_dashboard_admin(self, admin_token):
        """Test admin dashboard still works"""
        res = requests.get(f"{BASE_URL}/api/dashboard/admin", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200
        print(f"✅ Admin dashboard working")
    
    def test_users_list(self, admin_token):
        """Test users list still works"""
        res = requests.get(f"{BASE_URL}/api/users", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200
        print(f"✅ Users list working")
    
    def test_products_list(self):
        """Test products list (public) still works"""
        res = requests.get(f"{BASE_URL}/api/products")
        assert res.status_code == 200
        print(f"✅ Products list working")
    
    def test_commissions_endpoint(self, admin_token):
        """Test commissions endpoint still works"""
        res = requests.get(f"{BASE_URL}/api/commissions", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200
        print(f"✅ Commissions endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
