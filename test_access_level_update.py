import requests

base = 'http://localhost:8001'

# Login admin
token_admin = requests.post(f'{base}/api/auth/login', json={'email':'admin@oxxpharma.com','password':'admin123'}).json()['token']
h_admin = {'Authorization': f'Bearer {token_admin}'}

# Criar perfil SEM admin_access
r = requests.post(f'{base}/api/admin/role-profiles', headers=h_admin, json={
    'name': 'Perfil Teste Acesso',
    'pages': ['orders'],
    'admin_access': False,
})
prof_id = r.json()['profile_id']
print(f'Perfil criado: {prof_id} (admin_access=False)')

# Criar usuario com esse perfil
r2 = requests.post(f'{base}/api/admin/users', headers=h_admin, json={
    'name': 'Teste Admin Access',
    'email': 'testeacesso@teste.com',
    'profile_id': prof_id,
    'send_first_access': False,
})
user_id = r2.json()['user'].get('user_id')
access_before = r2.json()['user'].get('access_level')
print(f'Usuario criado: {user_id}, access_level={access_before}')

# Agora ATUALIZA o perfil para admin_access=True
r3 = requests.put(f'{base}/api/admin/role-profiles/{prof_id}', headers=h_admin, json={'admin_access': True})
prof_data = r3.json()
print(f'Perfil atualizado: admin_access={prof_data.get("admin_access")}')

# Verifica usuario agora (sem logout, para verificar se algo mudou)
r4 = requests.get(f'{base}/api/admin/users', headers=h_admin, params={'q': 'testeacesso'})
user_data = r4.json()['users'][0]
access_after = user_data.get('access_level')
print(f'Usuario now access_level={access_after}')

if access_after <= 1:
    print('✓ Access level foi atualizado (deve fazer logout/login para ver o menu)')
else:
    print('✗ Access level ainda é 99')
    print(f'User doc: {user_data}')
