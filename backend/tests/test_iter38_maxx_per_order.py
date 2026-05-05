"""Iter 38: Maxx envia 1 entrada por PEDIDO (agregando produtos)."""
from maxx_service import _build_payload


def test_build_payload_aggregates_by_order():
    points = [
        {"log_id": "p1", "user_id": "u1", "user_external_id": "EXT1",
         "user_name": "Joao", "user_email": "j@x.com",
         "points_total": 10.0, "registered_at": "2025-01-01T00:00:00",
         "order_id": "ord_AAA", "product_id": "p1", "product_name": "Vit C",
         "quantity": 2},
        {"log_id": "p2", "user_id": "u1", "user_external_id": "EXT1",
         "user_name": "Joao", "user_email": "j@x.com",
         "points_total": 5.0, "registered_at": "2025-01-01T00:00:00",
         "order_id": "ord_AAA", "product_id": "p2", "product_name": "Omega 3",
         "quantity": 1},
        # Pedido diferente do mesmo user
        {"log_id": "p3", "user_id": "u1", "user_external_id": "EXT1",
         "user_name": "Joao", "user_email": "j@x.com",
         "points_total": 7.5, "registered_at": "2025-01-02T00:00:00",
         "order_id": "ord_BBB", "product_id": "p3", "product_name": "Magnesio",
         "quantity": 3},
    ]
    out = _build_payload({}, points)
    assert out["count"] == 2  # 2 pedidos, nao 3 produtos
    items = out["points"]
    by_order = {it["order_id"]: it for it in items}
    aaa = by_order["ord_AAA"]
    assert abs(aaa["points"] - 15.0) < 0.001
    assert aaa["quantity"] == 3
    assert len(aaa["products"]) == 2
    # Resumo concatenado
    assert "Vit C" in aaa["product_name"] and "Omega 3" in aaa["product_name"]
    # Iter 39: produtos em linhas separadas
    assert "\n" in aaa["product_name"]
    bbb = by_order["ord_BBB"]
    assert abs(bbb["points"] - 7.5) < 0.001
    assert bbb["quantity"] == 3
    assert len(bbb["products"]) == 1


def test_build_payload_separates_users_for_same_order():
    # Cliente + sponsor espelhado no mesmo pedido = 2 entradas distintas
    points = [
        {"log_id": "p1", "user_id": "u1", "user_external_id": "EXT1",
         "user_name": "Cliente", "user_email": "c@x.com",
         "points_total": 10.0, "order_id": "ord_X", "product_name": "A", "quantity": 1},
        {"log_id": "p2", "user_id": "u2", "user_external_id": "EXT2",
         "user_name": "Sponsor", "user_email": "s@x.com",
         "points_total": 10.0, "order_id": "ord_X", "product_name": "A", "quantity": 1},
    ]
    out = _build_payload({}, points)
    assert out["count"] == 2
    users = {it["external_id"] for it in out["points"]}
    assert users == {"EXT1", "EXT2"}
