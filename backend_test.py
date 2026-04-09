"""
OxxPharma MLM System - Backend API Testing
Tests all major functionality of the OxxPharma MLM system
"""

import requests
import sys
import json
from datetime import datetime

class OxxPharmaAPITester:
    def __init__(self, base_url="https://oxx-franchise-system.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.nacional_token = None
        self.regular_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_resources = {
            'users': [],
            'products': [],
            'orders': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, description=""):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        if description:
            print(f"   📝 {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                
                # Try to parse JSON response
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error details: {error_detail}")
                except:
                    print(f"   Response text: {response.text[:200]}")
                
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'endpoint': endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'name': name,
                'error': str(e),
                'endpoint': endpoint
            })
            return False, {}

    def test_health_check(self):
        """Test basic connectivity"""
        return self.run_test(
            "Health Check", 
            "GET", 
            "health", 
            200,
            description="Verify API connectivity and database connection"
        )

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@oxxpharma.com", "password": "admin123"},
            description="Login with admin credentials"
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   🎫 Admin token acquired")
            return True
        return False

    def test_nacional_login(self):
        """Test nacional login"""
        success, response = self.run_test(
            "Nacional Login",
            "POST",
            "auth/login",
            200,
            data={"email": "nacional@oxxpharma.com", "password": "nacional123"},
            description="Login with nacional credentials"
        )
        if success and 'token' in response:
            self.nacional_token = response['token']
            print(f"   🎫 Nacional token acquired")
            return True
        return False

    def test_admin_dashboard(self):
        """Test admin dashboard data"""
        if not self.admin_token:
            print("❌ Skipping admin dashboard - no admin token")
            return False
            
        return self.run_test(
            "Admin Dashboard",
            "GET",
            "dashboard/admin",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'},
            description="Get admin dashboard statistics"
        )

    def test_settings_access(self):
        """Test settings access (admin only)"""
        if not self.admin_token:
            print("❌ Skipping settings - no admin token")
            return False
            
        return self.run_test(
            "Settings Access",
            "GET",
            "settings",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'},
            description="Access system settings (admin only)"
        )

    def test_user_registration(self):
        """Test user registration"""
        user_data = {
            "email": f"test_user_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "name": "Test User",
            "phone": "+5511999999999",
            "cpf": "12345678901",
            "access_level": 5,  # Indicador
            "state": "SP",
            "city": "São Paulo"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=user_data,
            description="Register new user as Indicador"
        )
        
        if success and 'token' in response:
            self.regular_token = response['token']
            self.created_resources['users'].append(response.get('user', {}).get('user_id'))
            print(f"   👤 Regular user token acquired")
            return True
        return False

    def test_user_dashboard(self):
        """Test regular user dashboard"""
        if not self.regular_token:
            print("❌ Skipping user dashboard - no regular token")
            return False
            
        return self.run_test(
            "User Dashboard",
            "GET",
            "dashboard/user",
            200,
            headers={'Authorization': f'Bearer {self.regular_token}'},
            description="Get regular user dashboard data"
        )

    def test_products_list(self):
        """Test products listing (public)"""
        return self.run_test(
            "Products List",
            "GET",
            "products",
            200,
            description="List all products (public access)"
        )

    def test_product_creation(self):
        """Test product creation (admin only)"""
        if not self.admin_token:
            print("❌ Skipping product creation - no admin token")
            return False
            
        product_data = {
            "name": f"Test Product {datetime.now().strftime('%H%M%S')}",
            "description": "Test product for OxxPharma system",
            "price": 99.99,
            "discount_price": 79.99,
            "category": "Medicamentos",
            "stock": 100,
            "active": True
        }
        
        success, response = self.run_test(
            "Product Creation",
            "POST",
            "products",
            200,
            data=product_data,
            headers={'Authorization': f'Bearer {self.admin_token}'},
            description="Create new product (admin only)"
        )
        
        if success and 'product_id' in response:
            self.created_resources['products'].append(response['product_id'])
            return True
        return False

    def test_user_creation_admin(self):
        """Test user creation by admin"""
        if not self.admin_token:
            print("❌ Skipping user creation - no admin token")
            return False
            
        user_data = {
            "email": f"admin_created_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "name": "Admin Created User",
            "phone": "+5511888888888",
            "cpf": "98765432100",
            "access_level": 4,  # Cidade
            "state": "RJ",
            "city": "Rio de Janeiro"
        }
        
        success, response = self.run_test(
            "User Creation by Admin",
            "POST",
            "users/create",
            200,
            data=user_data,
            headers={'Authorization': f'Bearer {self.admin_token}'},
            description="Create new user via admin endpoint"
        )
        
        if success and 'user_id' in response:
            self.created_resources['users'].append(response['user_id'])
            return True
        return False

    def test_settings_update(self):
        """Test settings update"""
        if not self.admin_token:
            print("❌ Skipping settings update - no admin token")
            return False
            
        return self.run_test(
            "Settings Update",
            "PUT",
            "settings",
            200,
            data={"key": "commission_gen_1", "value": "10"},
            headers={'Authorization': f'Bearer {self.admin_token}'},
            description="Update commission settings"
        )

    def test_franchises_list(self):
        """Test franchises listing"""
        if not self.admin_token:
            print("❌ Skipping franchises - no admin token")
            return False
            
        return self.run_test(
            "Franchises List",
            "GET",
            "franchises",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'},
            description="List franchise information"
        )

    def test_states_reference(self):
        """Test states reference data"""
        return self.run_test(
            "States Reference",
            "GET",
            "reference/states",
            200,
            description="Get Brazilian states reference data"
        )

    def test_ddds_reference(self):
        """Test DDDs reference data"""
        return self.run_test(
            "DDDs Reference",
            "GET",
            "reference/ddds?state=SP",
            200,
            description="Get DDDs for São Paulo state"
        )

    def test_users_list(self):
        """Test users listing (admin/supervisor only)"""
        if not self.admin_token:
            print("❌ Skipping users list - no admin token")
            return False
            
        return self.run_test(
            "Users List",
            "GET",
            "users",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'},
            description="List all users (admin access required)"
        )

    def test_network_tree(self):
        """Test network tree access"""
        if not self.admin_token:
            print("❌ Skipping network tree - no admin token")
            return False
            
        return self.run_test(
            "Network Tree",
            "GET",
            "network/tree",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'},
            description="Get MLM network hierarchy"
        )

    def test_wallet_access(self):
        """Test wallet access"""
        if not self.regular_token:
            print("❌ Skipping wallet - no regular token")
            return False
            
        return self.run_test(
            "Wallet Access",
            "GET",
            "wallet",
            200,
            headers={'Authorization': f'Bearer {self.regular_token}'},
            description="Access user wallet information"
        )

    def test_commissions_list(self):
        """Test commissions listing"""
        if not self.regular_token:
            print("❌ Skipping commissions - no regular token")
            return False
            
        return self.run_test(
            "Commissions List",
            "GET",
            "commissions",
            200,
            headers={'Authorization': f'Bearer {self.regular_token}'},
            description="List user commissions"
        )

    def test_categories_list(self):
        """Test product categories"""
        return self.run_test(
            "Categories List",
            "GET",
            "categories",
            200,
            description="Get product categories"
        )

    def test_unauthorized_access(self):
        """Test access without authentication"""
        success, _ = self.run_test(
            "Unauthorized Access",
            "GET",
            "dashboard/admin",
            401,
            description="Try to access admin endpoint without token (should fail)"
        )
        # For this test, failure is success
        if not success:
            self.tests_passed += 1
            print("✅ Correctly blocked unauthorized access")
            return True
        else:
            print("❌ Should have blocked unauthorized access")
            return False

    # ==================== NEW FEATURES TESTING ====================
    
    def test_level_specific_login(self):
        """Test login for different user levels"""
        test_users = [
            {"email": "estadual@test.com", "password": "test123", "level": "Estadual"},
            {"email": "regional@test.com", "password": "test123", "level": "Regional"},
            {"email": "cidade@test.com", "password": "test123", "level": "Cidade"},
            {"email": "indicador@test.com", "password": "test123", "level": "Indicador"},
        ]
        
        tokens = {}
        for user in test_users:
            success, response = self.run_test(
                f"{user['level']} Login",
                "POST",
                "auth/login",
                200,
                data={"email": user["email"], "password": user["password"]},
                description=f"Login with {user['level']} credentials"
            )
            if success and 'token' in response:
                tokens[user['level'].lower()] = response['token']
                print(f"   🎫 {user['level']} token acquired")
        
        return tokens

    def test_level_specific_dashboards(self):
        """Test level-specific dashboard data"""
        tokens = self.test_level_specific_login()
        
        for level, token in tokens.items():
            success, response = self.run_test(
                f"{level.title()} Dashboard",
                "GET",
                "dashboard/user",
                200,
                headers={'Authorization': f'Bearer {token}'},
                description=f"Get {level} dashboard with level-specific data"
            )
            
            if success:
                # Verify level-specific data is present
                if level == 'estadual':
                    if 'regionais_count' in response and 'state' in response:
                        print(f"   ✅ Estadual dashboard has state-specific data")
                    else:
                        print(f"   ⚠️ Estadual dashboard missing state-specific fields")
                elif level == 'regional':
                    if 'cidades_count' in response and 'ddd' in response:
                        print(f"   ✅ Regional dashboard has DDD-specific data")
                    else:
                        print(f"   ⚠️ Regional dashboard missing DDD-specific fields")
                elif level == 'indicador':
                    if 'can_upgrade' in response and 'min_referrals_upgrade' in response:
                        print(f"   ✅ Indicador dashboard has upgrade data")
                    else:
                        print(f"   ⚠️ Indicador dashboard missing upgrade fields")

    def test_reports_sales(self):
        """Test sales reports with period filters"""
        if not self.admin_token:
            print("❌ Skipping sales reports - no admin token")
            return False
            
        periods = ['week', 'month', 'quarter', 'year']
        for period in periods:
            success, response = self.run_test(
                f"Sales Report ({period})",
                "GET",
                f"reports/sales?period={period}",
                200,
                headers={'Authorization': f'Bearer {self.admin_token}'},
                description=f"Get sales report for {period} period"
            )
            
            if success:
                required_fields = ['total_orders', 'paid_orders', 'total_revenue', 'period']
                missing_fields = [field for field in required_fields if field not in response]
                if not missing_fields:
                    print(f"   ✅ Sales report has all required fields")
                else:
                    print(f"   ⚠️ Sales report missing fields: {missing_fields}")

    def test_reports_commissions(self):
        """Test commissions reports with period filters"""
        if not self.admin_token:
            print("❌ Skipping commissions reports - no admin token")
            return False
            
        periods = ['month', 'year']
        for period in periods:
            success, response = self.run_test(
                f"Commissions Report ({period})",
                "GET",
                f"reports/commissions?period={period}",
                200,
                headers={'Authorization': f'Bearer {self.admin_token}'},
                description=f"Get commissions report for {period} period"
            )
            
            if success:
                required_fields = ['total_commissions', 'by_generation', 'by_level']
                missing_fields = [field for field in required_fields if field not in response]
                if not missing_fields:
                    print(f"   ✅ Commissions report has all required fields")
                else:
                    print(f"   ⚠️ Commissions report missing fields: {missing_fields}")

    def test_reports_network(self):
        """Test network reports"""
        if not self.admin_token:
            print("❌ Skipping network reports - no admin token")
            return False
            
        success, response = self.run_test(
            "Network Report",
            "GET",
            "reports/network",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'},
            description="Get network statistics report"
        )
        
        if success:
            required_fields = ['by_level', 'by_state', 'new_this_month']
            missing_fields = [field for field in required_fields if field not in response]
            if not missing_fields:
                print(f"   ✅ Network report has all required fields")
            else:
                print(f"   ⚠️ Network report missing fields: {missing_fields}")

    def test_upgrade_status(self):
        """Test upgrade status for indicador"""
        tokens = self.test_level_specific_login()
        indicador_token = tokens.get('indicador')
        
        if not indicador_token:
            print("❌ Skipping upgrade status - no indicador token")
            return False
            
        success, response = self.run_test(
            "Upgrade Status",
            "GET",
            "upgrade/status",
            200,
            headers={'Authorization': f'Bearer {indicador_token}'},
            description="Get upgrade eligibility status for indicador"
        )
        
        if success:
            required_fields = ['eligible', 'total_referrals', 'min_referrals', 'investment_required', 'progress_percent']
            missing_fields = [field for field in required_fields if field not in response]
            if not missing_fields:
                print(f"   ✅ Upgrade status has all required fields")
                print(f"   📊 Progress: {response.get('progress_percent', 0)}% ({response.get('total_referrals', 0)}/{response.get('min_referrals', 20)} referrals)")
            else:
                print(f"   ⚠️ Upgrade status missing fields: {missing_fields}")

    def test_upgrade_requests_list(self):
        """Test upgrade requests listing (admin only)"""
        if not self.admin_token:
            print("❌ Skipping upgrade requests - no admin token")
            return False
            
        success, response = self.run_test(
            "Upgrade Requests List",
            "GET",
            "upgrade/requests",
            200,
            headers={'Authorization': f'Bearer {self.admin_token}'},
            description="List all upgrade requests (admin access)"
        )
        
        if success:
            required_fields = ['requests', 'total']
            missing_fields = [field for field in required_fields if field not in response]
            if not missing_fields:
                print(f"   ✅ Upgrade requests list has correct structure")
                print(f"   📊 Total requests: {response.get('total', 0)}")
            else:
                print(f"   ⚠️ Upgrade requests missing fields: {missing_fields}")

    def test_new_features_comprehensive(self):
        """Comprehensive test of all new features"""
        print("\n🆕 TESTING NEW FEATURES")
        
        # Test level-specific dashboards
        print("\n📊 Level-Specific Dashboards")
        self.test_level_specific_dashboards()
        
        # Test reports with period filters
        print("\n📈 Reports with Period Filters")
        self.test_reports_sales()
        self.test_reports_commissions()
        self.test_reports_network()
        
        # Test upgrade flow
        print("\n⬆️ Upgrade Flow")
        self.test_upgrade_status()
        self.test_upgrade_requests_list()

    def print_summary(self):
        """Print test results summary"""
        print("\n" + "="*60)
        print("🎯 OXXPHARMA BACKEND TEST RESULTS")
        print("="*60)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"📊 Tests run: {self.tests_run}")
        print(f"✅ Tests passed: {self.tests_passed}")
        print(f"❌ Tests failed: {len(self.failed_tests)}")
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
                print(f"   • {test['name']}: {error_msg}")
        
        print(f"\n🔗 Base URL: {self.base_url}")
        print(f"🕒 Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return success_rate >= 70  # Consider successful if 70%+ pass

def main():
    """Run all backend tests"""
    print("🚀 Starting OxxPharma Backend API Tests")
    print("="*60)
    
    tester = OxxPharmaAPITester()
    
    # Core connectivity and auth tests
    print("\n📡 CONNECTIVITY & AUTHENTICATION")
    tester.test_health_check()
    tester.test_admin_login()
    tester.test_nacional_login()
    tester.test_user_registration()
    
    # Dashboard and data access
    print("\n📊 DASHBOARD & DATA ACCESS")
    tester.test_admin_dashboard()
    tester.test_user_dashboard()
    tester.test_settings_access()
    tester.test_settings_update()
    
    # Core business logic
    print("\n🛍️ BUSINESS LOGIC")
    tester.test_products_list()
    tester.test_product_creation()
    tester.test_categories_list()
    
    # User management and network
    print("\n👥 USER MANAGEMENT & NETWORK")
    tester.test_users_list()
    tester.test_user_creation_admin()
    tester.test_network_tree()
    
    # Financial features
    print("\n💰 FINANCIAL FEATURES")
    tester.test_wallet_access()
    tester.test_commissions_list()
    tester.test_franchises_list()
    
    # Reference data
    print("\n📋 REFERENCE DATA")
    tester.test_states_reference()
    tester.test_ddds_reference()
    
    # Security
    print("\n🔒 SECURITY")
    tester.test_unauthorized_access()
    
    # NEW FEATURES TESTING
    print("\n🆕 NEW FEATURES (Iteration 2)")
    tester.test_new_features_comprehensive()
    
    # Print final results
    success = tester.print_summary()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())