# Petty Cash API regression tests (create/list/filters/roles/patch/delete/upload)
import io
import os
import struct
import zlib

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = ("admin@jollys.com", "Admin123!")
STAFF1 = ("test_petty_staff1@jollys.com", "TestStaff123!")
STAFF2 = ("test_petty_staff2@jollys.com", "TestStaff123!")
LOC = "timperley-altrincham"


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    if r.status_code != 200:
        pytest.skip(f"login failed for {email}: {r.status_code}")
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    s.cookies.clear()
    return s


def _png():
    raw = b"\x00\xff\x00\x00"
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


@pytest.fixture(scope="module")
def admin():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def staff1():
    return _login(*STAFF1)


@pytest.fixture(scope="module")
def staff2():
    return _login(*STAFF2)


@pytest.fixture(scope="module")
def created(admin):
    ids = []
    yield ids
    for i in ids:
        admin.delete(f"{BASE_URL}/api/petty-cash/{i}")


def _mk(s, created, **kw):
    p = {"location_id": LOC, "date": "2025-03-15", "amount": 4.25, "category": "Milk & Dairy",
         "description": "TEST_milk"}
    p.update(kw)
    r = s.post(f"{BASE_URL}/api/petty-cash", json=p)
    assert r.status_code == 200, r.text
    created.append(r.json()["id"])
    return r.json()


class TestPettyCash:
    def test_categories(self, admin):
        r = admin.get(f"{BASE_URL}/api/petty-cash/categories")
        assert r.status_code == 200
        assert len(r.json()["categories"]) == 7

    def test_unauth(self):
        assert requests.get(f"{BASE_URL}/api/petty-cash").status_code == 401
        r = requests.post(f"{BASE_URL}/api/petty-cash/upload-receipt", files={"file": ("a.png", _png(), "image/png")})
        assert r.status_code == 401

    def test_create_and_list(self, admin, created):
        d = _mk(admin, created, amount=3.333)
        assert d["amount"] == 3.33 and d["added_by"] == ADMIN[0]
        r = admin.get(f"{BASE_URL}/api/petty-cash", params={"date_from": "2025-03-15", "date_to": "2025-03-15"})
        ids = [x["id"] for x in r.json()["items"]]
        assert d["id"] in ids

    @pytest.mark.parametrize("bad", [{"amount": 0}, {"amount": -1}, {"category": "Beer"},
                                     {"description": ""}, {"date": "15/03/2025"}, {"amount": 20000}])
    def test_validation(self, admin, bad):
        p = {"location_id": LOC, "date": "2025-03-15", "amount": 1, "category": "Other", "description": "TEST_x"}
        p.update(bad)
        assert admin.post(f"{BASE_URL}/api/petty-cash", json=p).status_code == 422

    def test_whitespace_description(self, admin, created):
        p = {"location_id": LOC, "date": "2025-03-15", "amount": 1, "category": "Other", "description": "   "}
        r = admin.post(f"{BASE_URL}/api/petty-cash", json=p)
        if r.status_code == 200:
            created.append(r.json()["id"])
        print("whitespace-only description status:", r.status_code, r.text[:200])
        assert r.status_code == 422, "whitespace-only description accepted"

    def test_filters_and_aggregates(self, admin, created):
        a = _mk(admin, created, date="2024-01-05", amount=2.5, category="Cleaning", location_id="TEST_locA")
        b = _mk(admin, created, date="2024-01-06", amount=7.5, category="Supplies", location_id="TEST_locA")
        c = _mk(admin, created, date="2024-01-07", amount=1.0, category="Cleaning", location_id="TEST_locB")
        r = admin.get(f"{BASE_URL}/api/petty-cash", params={"date_from": "2024-01-05", "date_to": "2024-01-07", "location_id": "all"}).json()
        assert {a["id"], b["id"], c["id"]} <= {x["id"] for x in r["items"]}
        r = admin.get(f"{BASE_URL}/api/petty-cash", params={"date_from": "2024-01-05", "date_to": "2024-01-07", "location_id": "TEST_locA"}).json()
        assert r["count"] == 2 and r["total"] == 10.0
        assert r["by_category"] == {"Cleaning": 2.5, "Supplies": 7.5}
        assert r["by_location"] == {"TEST_locA": 10.0}
        r = admin.get(f"{BASE_URL}/api/petty-cash", params={"date_from": "2024-01-05", "date_to": "2024-01-07", "category": "Cleaning"}).json()
        assert {x["id"] for x in r["items"]} >= {a["id"], c["id"]} and b["id"] not in {x["id"] for x in r["items"]}
        r = admin.get(f"{BASE_URL}/api/petty-cash", params={"date_from": "2024-01-06", "date_to": "2024-01-06", "location_id": "TEST_locA"}).json()
        assert [x["id"] for x in r["items"]] == [b["id"]]
        assert admin.get(f"{BASE_URL}/api/petty-cash", params={"date_from": "bad"}).status_code == 422

    def test_staff_isolation(self, admin, staff1, staff2, created):
        s1 = _mk(staff1, created, description="TEST_staff1 entry", date="2024-02-01")
        a = _mk(admin, created, description="TEST_admin entry", date="2024-02-01")
        l1 = staff1.get(f"{BASE_URL}/api/petty-cash").json()
        assert all(x["added_by"] == STAFF1[0] for x in l1["items"])
        assert s1["id"] in {x["id"] for x in l1["items"]}
        l2 = staff2.get(f"{BASE_URL}/api/petty-cash").json()
        assert s1["id"] not in {x["id"] for x in l2["items"]}
        la = admin.get(f"{BASE_URL}/api/petty-cash", params={"date_from": "2024-02-01", "date_to": "2024-02-01"}).json()
        assert {s1["id"], a["id"]} <= {x["id"] for x in la["items"]}
        # staff2 cannot edit/delete staff1's or admin's entry
        assert staff2.patch(f"{BASE_URL}/api/petty-cash/{s1['id']}", json={"amount": 9}).status_code == 403
        assert staff2.delete(f"{BASE_URL}/api/petty-cash/{s1['id']}").status_code == 403
        assert staff1.patch(f"{BASE_URL}/api/petty-cash/{a['id']}", json={"amount": 9}).status_code == 403
        # staff1 can edit own
        r = staff1.patch(f"{BASE_URL}/api/petty-cash/{s1['id']}", json={"amount": 6.5, "description": "TEST_staff1 edited"})
        assert r.status_code == 200 and r.json()["amount"] == 6.5
        # admin can edit staff1 entry
        r = admin.patch(f"{BASE_URL}/api/petty-cash/{s1['id']}", json={"category": "Travel"})
        assert r.status_code == 200 and r.json()["category"] == "Travel" and r.json()["description"] == "TEST_staff1 edited"

    def test_patch_validation_and_404(self, admin, created):
        d = _mk(admin, created)
        assert admin.patch(f"{BASE_URL}/api/petty-cash/{d['id']}", json={"amount": -2}).status_code == 422
        assert admin.patch(f"{BASE_URL}/api/petty-cash/{d['id']}", json={"category": "Beer"}).status_code == 422
        assert admin.patch(f"{BASE_URL}/api/petty-cash/nonexistent-id", json={"amount": 2}).status_code == 404

    def test_soft_delete(self, admin, staff1, created):
        d = _mk(staff1, created, date="2024-03-01")
        assert staff1.delete(f"{BASE_URL}/api/petty-cash/{d['id']}").status_code == 200
        items = admin.get(f"{BASE_URL}/api/petty-cash", params={"date_from": "2024-03-01", "date_to": "2024-03-01"}).json()["items"]
        assert d["id"] not in {x["id"] for x in items}
        assert admin.patch(f"{BASE_URL}/api/petty-cash/{d['id']}", json={"amount": 2}).status_code == 404
        assert admin.delete(f"{BASE_URL}/api/petty-cash/{d['id']}").status_code == 404

    def test_admin_delete_staff_entry(self, admin, staff1, created):
        d = _mk(staff1, created, date="2024-03-02")
        assert admin.delete(f"{BASE_URL}/api/petty-cash/{d['id']}").status_code == 200

    def test_upload_receipt(self, staff1, created):
        r = staff1.post(f"{BASE_URL}/api/petty-cash/upload-receipt", files={"file": ("r.png", _png(), "image/png")})
        assert r.status_code == 200, r.text
        url = r.json()["image_url"]
        assert url.startswith("/api/images/receipt_")
        g = requests.get(f"{BASE_URL}{url}")
        assert g.status_code == 200 and g.headers["content-type"].startswith("image/")
        d = _mk(staff1, created, receipt_url=url, date="2024-03-03")
        assert d["receipt_url"] == url
        bad = staff1.post(f"{BASE_URL}/api/petty-cash/upload-receipt", files={"file": ("a.txt", b"hello", "text/plain")})
        assert bad.status_code == 400
