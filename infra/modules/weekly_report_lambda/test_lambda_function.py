import pytest
from lambda_function import calculate_anomalies, calculate_week_days, build_ticket_text

def make_item(data, total, services):
    return {"data": data, "totalCost": str(total), "services": {k: str(v) for k, v in services.items()}}

# ── calculate_anomalies ───────────────────────────────────────

def test_anomaly_detected_when_service_cost_increases_over_20pct():
    baseline = [make_item(f"2026-04-{i:02d}", 100, {"Amazon EC2": 80}) for i in range(1, 29)]
    week     = [make_item(f"2026-05-{i:02d}", 130, {"Amazon EC2": 110}) for i in range(1, 8)]
    anomalies = calculate_anomalies(week, baseline)
    assert len(anomalies) == 1
    assert anomalies[0]["service"] == "Amazon EC2"
    assert anomalies[0]["variacao_pct"] > 20

def test_no_anomaly_when_variation_under_20pct():
    baseline = [make_item(f"2026-04-{i:02d}", 100, {"Amazon EC2": 80}) for i in range(1, 29)]
    week     = [make_item(f"2026-05-{i:02d}", 110, {"Amazon EC2": 90}) for i in range(1, 8)]
    anomalies = calculate_anomalies(week, baseline)
    assert len(anomalies) == 0

def test_no_anomaly_when_service_cost_below_1_dollar():
    baseline = [make_item(f"2026-04-{i:02d}", 10, {"AWS CloudTrail": 0.05}) for i in range(1, 29)]
    week     = [make_item(f"2026-05-{i:02d}", 15, {"AWS CloudTrail": 0.80}) for i in range(1, 8)]
    anomalies = calculate_anomalies(week, baseline)
    assert len(anomalies) == 0

def test_empty_baseline_returns_no_anomalies():
    week = [make_item(f"2026-05-{i:02d}", 100, {"Amazon EC2": 80}) for i in range(1, 8)]
    assert calculate_anomalies(week, []) == []

# ── calculate_week_days ───────────────────────────────────────

def test_status_red_when_total_variation_over_20pct():
    week = [make_item("2026-05-06", 150, {})]
    days = calculate_week_days(week, baseline_total_mean=100.0)
    assert days[0]["status"] == "red"
    assert days[0]["variacao_pct"] == pytest.approx(50.0, rel=0.01)

def test_status_yellow_when_total_variation_between_10_and_20pct():
    week = [make_item("2026-05-06", 115, {})]
    days = calculate_week_days(week, baseline_total_mean=100.0)
    assert days[0]["status"] == "yellow"

def test_status_green_when_total_variation_under_10pct():
    week = [make_item("2026-05-06", 105, {})]
    days = calculate_week_days(week, baseline_total_mean=100.0)
    assert days[0]["status"] == "green"

# ── build_ticket_text ─────────────────────────────────────────

def test_ticket_without_anomalies_contains_ok_message():
    text = build_ticket_text([])
    assert "não foram identificadas oscilações" in text
    assert "Rafael Santiago" in text

def test_ticket_with_anomalies_lists_services():
    anomalies = [{"service": "Amazon EC2", "variacao_pct": 36.2, "media_atual": 98.50, "media_baseline": 72.30}]
    text = build_ticket_text(anomalies)
    assert "Amazon EC2" in text
    assert "36.2%" in text
    assert "$72.30" in text
    assert "$98.50" in text
