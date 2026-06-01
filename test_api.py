#!/usr/bin/env python3
import requests
import json

def test_profile_creation():
    """Testa criação de perfil via API"""
    base_url = 'http://localhost:8001'
    
    # 1. Login
    print("=== Login ===")
    login_data = {'email': 'admin@oxxpharma.com', 'password': 'admin123'}
    try:
        login_resp = requests.post(f'{base_url}/api/auth/login', json=login_data, timeout=5)
        print(f'Status: {login_resp.status_code}')
        
        if login_resp.status_code == 200:
            token = login_resp.json().get('token')
            print(f'✓ Login successful')
            print(f'Token: {token[:50]}...')
        else:
            print(f'✗ Login failed: {login_resp.text}')
            return
    except Exception as e:
        print(f'✗ Login error: {e}')
        return
    
    # 2. Create profile
    print("\n=== Create Profile ===")
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    profile_data = {
        'name': 'Teste Perfil API',
        'description': 'Descrição de teste',
        'pages': ['dashboard', 'orders', 'users']
    }
    
    try:
        profile_resp = requests.post(
            f'{base_url}/api/admin/role-profiles',
            json=profile_data,
            headers=headers,
            timeout=5
        )
        print(f'Status: {profile_resp.status_code}')
        print(f'Response: {profile_resp.text}')
        
        if profile_resp.status_code in (200, 201):
            print('✓ Profile created successfully')
            result = profile_resp.json()
            print(f'Profile ID: {result.get("profile_id")}')
            print(f'Name: {result.get("name")}')
        else:
            print(f'✗ Failed to create profile')
            
    except Exception as e:
        print(f'✗ Error: {e}')

if __name__ == '__main__':
    test_profile_creation()
