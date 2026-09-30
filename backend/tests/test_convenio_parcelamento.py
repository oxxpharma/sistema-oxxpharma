import unittest
from datetime import datetime, timezone
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from convenio_routes import _get_cutoff_period, _add_months

class TestConvenioParcelamento(unittest.TestCase):
    def test_cutoff_period_before_26(self):
        dt = datetime(2026, 9, 20, 10, 0, 0, tzinfo=timezone.utc)
        period = _get_cutoff_period(dt)
        self.assertEqual(period, "2026-09")

    def test_cutoff_period_on_26(self):
        dt = datetime(2026, 9, 26, 23, 59, 59, tzinfo=timezone.utc)
        period = _get_cutoff_period(dt)
        self.assertEqual(period, "2026-09")

    def test_cutoff_period_after_26(self):
        dt = datetime(2026, 9, 27, 0, 0, 1, tzinfo=timezone.utc)
        period = _get_cutoff_period(dt)
        self.assertEqual(period, "2026-10")

    def test_cutoff_period_end_of_year_after_26(self):
        dt = datetime(2026, 12, 28, 15, 30, 0, tzinfo=timezone.utc)
        period = _get_cutoff_period(dt)
        self.assertEqual(period, "2027-01")

    def test_add_months_simple(self):
        self.assertEqual(_add_months("2026-09", 1), "2026-10")
        self.assertEqual(_add_months("2026-09", 3), "2026-12")
        self.assertEqual(_add_months("2026-09", 4), "2027-01")

    def test_add_months_year_overflow(self):
        self.assertEqual(_add_months("2026-11", 2), "2027-01")
        self.assertEqual(_add_months("2026-12", 12), "2027-12")

    def test_installment_limits_calculation(self):
        # Test math logic for 30% monthly margin & 100% total limit
        salary = 3000.0
        monthly_margin = round(salary * 0.30, 2)
        total_limit = round(salary, 2)

        self.assertEqual(monthly_margin, 900.0)
        self.assertEqual(total_limit, 3000.0)

        # Purchase total R$ 3.000 in 4x de R$ 750,00
        purchase_total = 3000.0
        installments = 4
        inst_amount = purchase_total / installments

        self.assertEqual(inst_amount, 750.0)
        self.assertLessEqual(inst_amount, monthly_margin)  # 750 <= 900 OK
        self.assertLessEqual(purchase_total, total_limit) # 3000 <= 3000 OK

if __name__ == '__main__':
    unittest.main()
