"""
MLM Vanguard System - Backend API Tests
Tests for authentication, orders, withdrawals, and dashboard APIs
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://oxx-franchise-system.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@vanguard.com"
ADMIN_PASSWORD = "admin123"


class TestHealth:
    """Health check tests - run first"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        res = requests.get(f"{BASE_URL}/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "healthy"
        assert data.get("database") == "connected"
        print(f"✅ Health check passed: {data}")


class TestAuthentication:
    """Authentication flow tests"""
    
    def test_login_with_admin_credentials(self):
        """Test login with admin@vanguard.com / admin123"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert res.status_code == 200, f"Login failed: {res.text}"
        data = res.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["access_level"] == 0  # Admin técnico
        print(f"✅ Admin login successful: {data['user']['name']}")
    
    def test_login_with_invalid_credentials(self):
        """Test login with wrong credentials returns 401"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert res.status_code == 401
        print("✅ Invalid credentials correctly rejected")
    
    def test_auth_me_requires_token(self):
        """Test /api/auth/me requires authentication"""
        res = requests.get(f"{BASE_URL}/api/auth/me")
        assert res.status_code == 401
        print("✅ /api/auth/me correctly requires authentication")


class TestAdminDashboard:
    """Admin dashboard API tests"""
    
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
    
    def test_dashboard_admin_endpoint(self, admin_token):
        """Test /api/dashboard/admin returns statistics"""
        res = requests.get(f"{BASE_URL}/api/dashboard/admin", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200, f"Dashboard failed: {res.text}"
        data = res.json()
        
        # Verify response structure
        assert "user_counts" in data, "user_counts missing"
        assert "active_resellers" in data, "active_resellers missing"
        assert "orders_this_month" in data, "orders_this_month missing"
        assert "commissions" in data, "commissions missing"
        assert "withdrawals_pending" in data, "withdrawals_pending missing"
        
        # Verify data types
        assert isinstance(data["user_counts"], dict)
        assert isinstance(data["active_resellers"], int)
        assert isinstance(data["orders_this_month"], dict)
        
        print(f"✅ Admin dashboard data: user_counts={len(data['user_counts'])}, active_resellers={data['active_resellers']}")
    
    def test_dashboard_admin_requires_auth(self):
        """Test /api/dashboard/admin requires authentication"""
        res = requests.get(f"{BASE_URL}/api/dashboard/admin")
        assert res.status_code == 401
        print("✅ Admin dashboard correctly requires authentication")


class TestOrders:
    """Orders API tests"""
    
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
    
    def test_list_orders(self, admin_token):
        """Test GET /api/orders returns orders list"""
        res = requests.get(f"{BASE_URL}/api/orders?page=1&limit=10", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200, f"List orders failed: {res.text}"
        data = res.json()
        
        # Verify response structure
        assert "orders" in data, "orders missing"
        assert "total" in data, "total missing"
        assert "page" in data, "page missing"
        assert "pages" in data, "pages missing"
        
        # Verify data types
        assert isinstance(data["orders"], list)
        assert isinstance(data["total"], int)
        
        print(f"✅ Orders list: total={data['total']}, current_page={data['page']}")
    
    def test_list_orders_with_status_filter(self, admin_token):
        """Test orders filtering by status"""
        res = requests.get(f"{BASE_URL}/api/orders?page=1&limit=10&status=pending", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200
        data = res.json()
        
        # All orders should have pending status
        for order in data["orders"]:
            assert order.get("order_status") == "pending", f"Found non-pending order: {order.get('order_id')}"
        
        print(f"✅ Filtered orders by status: found {len(data['orders'])} pending orders")
    
    def test_orders_requires_auth(self):
        """Test /api/orders requires authentication"""
        res = requests.get(f"{BASE_URL}/api/orders")
        assert res.status_code == 401
        print("✅ Orders list correctly requires authentication")


class TestWithdrawals:
    """Withdrawals API tests"""
    
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
    
    def test_list_withdrawals(self, admin_token):
        """Test GET /api/wallet/withdrawals returns withdrawals list"""
        res = requests.get(f"{BASE_URL}/api/wallet/withdrawals?page=1&limit=20", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200, f"List withdrawals failed: {res.text}"
        data = res.json()
        
        # Verify response structure
        assert "withdrawals" in data, "withdrawals missing"
        assert "total" in data, "total missing"
        assert "page" in data, "page missing"
        
        # Verify data types
        assert isinstance(data["withdrawals"], list)
        assert isinstance(data["total"], int)
        
        print(f"✅ Withdrawals list: total={data['total']}, current_page={data['page']}")
    
    def test_list_withdrawals_with_status_filter(self, admin_token):
        """Test withdrawals filtering by status"""
        res = requests.get(f"{BASE_URL}/api/wallet/withdrawals?status=pending", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200
        data = res.json()
        
        # All withdrawals should have pending status
        for wd in data["withdrawals"]:
            assert wd.get("status") == "pending", f"Found non-pending withdrawal"
        
        print(f"✅ Filtered withdrawals by status: found {len(data['withdrawals'])} pending")
    
    def test_withdrawals_requires_auth(self):
        """Test /api/wallet/withdrawals requires authentication"""
        res = requests.get(f"{BASE_URL}/api/wallet/withdrawals")
        assert res.status_code == 401
        print("✅ Withdrawals list correctly requires authentication")


class TestProducts:
    """Products API tests"""
    
    def test_list_products_public(self):
        """Test GET /api/products is public (no auth required)"""
        res = requests.get(f"{BASE_URL}/api/products?page=1&limit=12&active=true")
        assert res.status_code == 200, f"List products failed: {res.text}"
        data = res.json()
        
        # Verify response structure
        assert "products" in data, "products missing"
        assert "total" in data, "total missing"
        
        print(f"✅ Products list (public): total={data['total']}")
    
    def test_list_categories(self):
        """Test GET /api/categories is public"""
        res = requests.get(f"{BASE_URL}/api/categories")
        assert res.status_code == 200
        data = res.json()
        
        assert "categories" in data
        print(f"✅ Categories list: {data['categories']}")


class TestLogs:
    """Logs API tests"""
    
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
    
    def test_list_logs(self, admin_token):
        """Test GET /api/logs returns logs list"""
        res = requests.get(f"{BASE_URL}/api/logs?page=1&limit=50", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200, f"List logs failed: {res.text}"
        data = res.json()
        
        # Verify response structure
        assert "logs" in data, "logs missing"
        assert "total" in data, "total missing"
        
        print(f"✅ Logs list: total={data['total']}")
    
    def test_logs_requires_admin(self):
        """Test /api/logs requires admin authentication"""
        res = requests.get(f"{BASE_URL}/api/logs")
        assert res.status_code == 401
        print("✅ Logs correctly requires admin authentication")


class TestWallet:
    """Wallet API tests"""
    
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
    
    def test_get_wallet(self, admin_token):
        """Test GET /api/wallet returns wallet data"""
        res = requests.get(f"{BASE_URL}/api/wallet", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200, f"Get wallet failed: {res.text}"
        data = res.json()
        
        # Verify response structure
        assert "available_balance" in data, "available_balance missing"
        assert "blocked_balance" in data, "blocked_balance missing"
        assert "transactions" in data, "transactions missing"
        
        print(f"✅ Wallet data: available={data['available_balance']}, blocked={data['blocked_balance']}")


class TestCreateOrderFlow:
    """Test complete order creation flow"""
    
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
    
    def test_create_product_then_order(self, admin_token):
        """Test creating a product and then placing an order"""
        # First, create a test product
        product_data = {
            "name": "TEST_Produto Teste",
            "description": "Produto para teste automatizado",
            "price": 99.90,
            "discount_price": 89.90,
            "category": "Teste",
            "images": [],
            "stock": 100,
            "active": True
        }
        
        res = requests.post(f"{BASE_URL}/api/products", json=product_data, headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200, f"Create product failed: {res.text}"
        product = res.json()
        product_id = product["product_id"]
        print(f"✅ Created test product: {product_id}")
        
        # Now create an order with this product
        order_data = {
            "items": [{"product_id": product_id, "quantity": 2}],
            "shipping_address": {
                "name": "Test User",
                "street": "Rua Teste",
                "number": "123",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip": "01000-000"
            },
            "payment_method": "pix"
        }
        
        res = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200, f"Create order failed: {res.text}"
        order = res.json()
        
        # Verify order data
        assert "order_id" in order
        assert order["total"] == 89.90 * 2 + 15.0  # 2 items + shipping
        assert order["payment_status"] == "pending"
        assert order["order_status"] == "pending"
        
        print(f"✅ Created test order: {order['order_id']}, total: R${order['total']}")
        
        # Verify order in list
        res = requests.get(f"{BASE_URL}/api/orders/{order['order_id']}", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200
        fetched_order = res.json()
        assert fetched_order["order_id"] == order["order_id"]
        print("✅ Order verified in database")
        
        # Clean up - delete product
        res = requests.delete(f"{BASE_URL}/api/products/{product_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert res.status_code == 200
        print("✅ Test product cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
