#!/usr/bin/env python3
import requests
import json

def test_get_profiles():
    """Testa listagem de perfis"""
    base_url = 'http://localhost:8001'
    
    # Login
    login_data = {'email': 'admin@oxxpharma.com', 'password': 'admin123'}
    login_resp = requests.post(f'{base_url}/api/auth/login', json=login_data)
    token = login_resp.json().get('token')
    
    # Get all profiles
    headers = {'Authorization': f'Bearer {token}'}
    profiles_resp = requests.get(f'{base_url}/api/admin/role-profiles', headers=headers)
    
    print(f"=== Get All Profiles ===")
    print(f"Status: {profiles_resp.status_code}")
    
    profiles = profiles_resp.json().get('profiles', [])
    print(f"Total profiles: {len(profiles)}")
    print()
    
    print("System Profiles:")
    for p in profiles:
        if p.get('is_system'):
            print(f"  • {p['profile_id']}: {p['name']} ({len(p['pages'])} pages)")
    
    print("\nCustom Profiles:")
    custom_count = 0
    for p in profiles:
        if not p.get('is_system'):
            custom_count += 1
            pages_str = ', '.join(p['pages'])
            print(f"  ✓ {p['profile_id']}: {p['name']}")
            print(f"     Pages: {pages_str}")
    
    if custom_count == 0:
        print("  (none)")

if __name__ == '__main__':
    test_get_profiles()
