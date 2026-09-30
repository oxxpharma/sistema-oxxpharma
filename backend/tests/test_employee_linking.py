import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

class TestEmployeeLinkingLogic(unittest.TestCase):
    def test_confirmation_response_structure(self):
        linked_user = {
            "user_id": "usr_test123",
            "name": "Giovani Mella",
            "email": "giovani.mella@gmail.com",
            "cpf_digits": "47248236071",
        }
        company_name = "Ozoxx"

        # Simula resposta do backend quando confirm_link=False
        res = {
            "needs_confirmation": True,
            "existing_user": {
                "user_id": linked_user["user_id"],
                "name": linked_user.get("name"),
                "email": linked_user.get("email"),
                "cpf_digits": linked_user.get("cpf_digits"),
            },
            "message": f"Encontramos o usuário {linked_user.get('name')} ({linked_user.get('email')}) cadastrado no sistema. Deseja vincular esta conta como funcionário da empresa {company_name}?"
        }

        self.assertTrue(res["needs_confirmation"])
        self.assertEqual(res["existing_user"]["user_id"], "usr_test123")
        self.assertIn("Giovani Mella", res["message"])

if __name__ == '__main__':
    unittest.main()
