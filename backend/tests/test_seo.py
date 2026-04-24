"""SEO tests for sitemap.xml and route-specific meta tag injection"""
import re
import pytest
import requests

# Backend SEO is served from localhost:8001 (preview routes non-/api to Vite)
BASE_URL = "http://localhost:8001"


@pytest.fixture
def client():
    s = requests.Session()
    return s


# ============== SITEMAP ==============

class TestSitemap:
    def test_sitemap_returns_200(self, client):
        r = client.get(f"{BASE_URL}/sitemap.xml")
        assert r.status_code == 200

    def test_sitemap_content_type_xml(self, client):
        r = client.get(f"{BASE_URL}/sitemap.xml")
        assert "xml" in r.headers.get("content-type", "").lower()

    def test_sitemap_valid_xml_header(self, client):
        r = client.get(f"{BASE_URL}/sitemap.xml")
        assert r.text.startswith('<?xml version="1.0" encoding="UTF-8"?>')
        assert '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' in r.text

    def test_sitemap_has_11_urls(self, client):
        r = client.get(f"{BASE_URL}/sitemap.xml")
        url_count = r.text.count("<url>")
        assert url_count == 11, f"Expected 11 URLs, got {url_count}"

    def test_sitemap_contains_all_core_pages(self, client):
        r = client.get(f"{BASE_URL}/sitemap.xml")
        for path in ["/", "/jklocations", "/menu-catalog", "/contact-us",
                     "/table-reservation", "/customer-auth"]:
            assert f"https://www.jollyskafe.com{path}" in r.text, f"Missing {path}"

    def test_sitemap_contains_all_location_pages(self, client):
        r = client.get(f"{BASE_URL}/sitemap.xml")
        for slug in ["handforth", "middlewich", "timperley", "atherton", "chaddesden"]:
            assert f"https://www.jollyskafe.com/{slug}" in r.text, f"Missing {slug}"


# ============== META TAG INJECTION ==============

LOCATION_EXPECTED = {
    "handforth": {
        "title": "Jolly's Kafe Handforth | Café & Brunch in Oakmere, Wilmslow Road",
        "desc_contains": "Oakmere, Handforth",
    },
    "middlewich": {
        "title": "Jolly's Kafe Middlewich | Canal-side Café at Willowmere",
        "desc_contains": "Willowmere, Middlewich",
    },
    "timperley": {
        "title": "Jolly's Kafe Timperley | Café & Breakfast in Altrincham",
        "desc_contains": "Timperley, Altrincham",
    },
    "atherton": {
        "title": "Jolly's Kafe Atherton | Café & Breakfast at Howe Bridge",
        "desc_contains": "Howe Bridge, Atherton",
    },
    "chaddesden": {
        "title": "Jolly's Kafe Chaddesden | Café & Breakfast in Derby",
        "desc_contains": "Chaddesden, Derby",
    },
}


@pytest.mark.parametrize("slug,expected", list(LOCATION_EXPECTED.items()))
class TestLocationMetaTags:
    def test_location_returns_200(self, client, slug, expected):
        r = client.get(f"{BASE_URL}/{slug}")
        assert r.status_code == 200

    def test_location_title(self, client, slug, expected):
        r = client.get(f"{BASE_URL}/{slug}")
        titles = re.findall(r"<title>(.*?)</title>", r.text)
        assert len(titles) == 1, f"Expected 1 <title>, got {len(titles)}: {titles}"
        assert titles[0] == expected["title"]

    def test_location_description_present_and_unique(self, client, slug, expected):
        r = client.get(f"{BASE_URL}/{slug}")
        descs = re.findall(r'<meta\s+name="description"\s+content="([^"]*)"', r.text)
        assert len(descs) == 1, f"Expected 1 description, got {len(descs)}"
        assert expected["desc_contains"] in descs[0]

    def test_location_og_tags(self, client, slug, expected):
        r = client.get(f"{BASE_URL}/{slug}")
        assert 'property="og:title"' in r.text
        assert 'property="og:description"' in r.text
        assert 'property="og:url"' in r.text
        assert f'content="https://www.jollyskafe.com/{slug}"' in r.text

    def test_location_canonical(self, client, slug, expected):
        r = client.get(f"{BASE_URL}/{slug}")
        assert f'<link rel="canonical" href="https://www.jollyskafe.com/{slug}"' in r.text

    def test_location_jsonld_cafe(self, client, slug, expected):
        r = client.get(f"{BASE_URL}/{slug}")
        assert '<script type="application/ld+json">' in r.text
        assert '"@type": "CafeOrCoffeeShop"' in r.text or '"@type":"CafeOrCoffeeShop"' in r.text


# ============== CORE PAGES META TAGS ==============

CORE_EXPECTED = {
    "": {
        "title": "Jolly's Kafe | Fresh Food, Great Coffee, Warm Welcome",
        "canonical": "https://www.jollyskafe.com",
        "jsonld_type": "Restaurant",
    },
    "menu-catalog": {
        "title": "Menu | Jolly's Kafe — Breakfasts, Lunches & Drinks",
        "canonical": "https://www.jollyskafe.com/menu-catalog",
        "jsonld_type": "Restaurant",
    },
    "contact-us": {
        "title": "Contact Us | Jolly's Kafe",
        "canonical": "https://www.jollyskafe.com/contact-us",
        "jsonld_type": "Restaurant",
    },
    "jklocations": {
        "title": "Our Locations | Jolly's Kafe — Find Your Nearest Café",
        "canonical": "https://www.jollyskafe.com/jklocations",
        "jsonld_type": "Restaurant",
    },
}


@pytest.mark.parametrize("path,expected", list(CORE_EXPECTED.items()))
class TestCorePageMeta:
    def test_core_title_unique_and_correct(self, client, path, expected):
        r = client.get(f"{BASE_URL}/{path}")
        assert r.status_code == 200
        titles = re.findall(r"<title>(.*?)</title>", r.text)
        assert len(titles) == 1, f"Expected 1 <title>, got {len(titles)} for /{path}"
        assert titles[0] == expected["title"]

    def test_core_description_unique(self, client, path, expected):
        r = client.get(f"{BASE_URL}/{path}")
        descs = re.findall(r'<meta\s+name="description"\s+content="[^"]*"', r.text)
        assert len(descs) == 1, f"Expected 1 description, got {len(descs)} for /{path}"

    def test_core_canonical(self, client, path, expected):
        r = client.get(f"{BASE_URL}/{path}")
        assert f'<link rel="canonical" href="{expected["canonical"]}"' in r.text

    def test_core_jsonld(self, client, path, expected):
        r = client.get(f"{BASE_URL}/{path}")
        assert '<script type="application/ld+json">' in r.text
        t = expected["jsonld_type"]
        assert f'"@type": "{t}"' in r.text or f'"@type":"{t}"' in r.text


# ============== ROBOTS.TXT ==============

class TestRobots:
    def test_robots_references_sitemap(self, client):
        r = client.get(f"{BASE_URL}/robots.txt")
        # Served from static build dir
        assert r.status_code == 200
        assert "sitemap" in r.text.lower()
