"""SEO helpers — route-specific meta tags, JSON-LD, sitemap generation"""

BASE_URL = "https://www.jollyskafe.com"

# Location SEO data with targeted keywords
LOCATION_SEO = {
    "oakmere-handforth": {
        "slug": "handforth",
        "title": "Jolly's Kafe Handforth | Café & Brunch in Oakmere, Wilmslow Road",
        "description": "Independent café in Oakmere, Handforth. Fresh breakfasts, brunch, specialty coffee & homemade food. Dog friendly café near Handforth Dean. Open daily.",
        "keywords": "café Handforth, coffee shop Wilmslow, brunch Handforth, breakfast near me SK9, independent café Cheshire, dog friendly café Handforth, community café Handforth, café near Handforth Dean, Oakmere café",
        "area": "Handforth, Cheshire",
        "postal_code": "SK9",
    },
    "willowmere-middlewich": {
        "slug": "middlewich",
        "title": "Jolly's Kafe Middlewich | Canal-side Café at Willowmere",
        "description": "Welcoming café in Willowmere, Middlewich. Full English breakfasts, lunches & afternoon tea by the canal. Perfect stop for narrowboat visitors. Open daily.",
        "keywords": "café Middlewich, coffee shop Middlewich, canal café Cheshire, narrowboat stop café, brunch Middlewich, breakfast Cheshire East, Folk Festival café 2026, things to do Middlewich, Willowmere café",
        "area": "Middlewich, Cheshire",
        "postal_code": "CW10",
    },
    "timperley-altrincham": {
        "slug": "timperley",
        "title": "Jolly's Kafe Timperley | Café & Breakfast in Altrincham",
        "description": "Popular café in Timperley, Altrincham. Full breakfasts, omelettes, paninis, Sunday roasts & specialty coffee. Family friendly. Open daily.",
        "keywords": "café Timperley, coffee shop Altrincham, breakfast Timperley, brunch Altrincham, Sunday roast Timperley, café near me Trafford, independent café Altrincham",
        "area": "Timperley, Altrincham",
        "postal_code": "WA15",
    },
    "howe-bridge-atherton": {
        "slug": "atherton",
        "title": "Jolly's Kafe Atherton | Café & Breakfast at Howe Bridge",
        "description": "Friendly café at Howe Bridge, Atherton. Classic breakfasts, burgers, jacket potatoes, curries & hot drinks. Vegetarian options available. Open daily.",
        "keywords": "café Atherton, coffee shop Atherton, breakfast Atherton, Howe Bridge café, café near me Wigan, brunch Atherton, independent café Greater Manchester",
        "area": "Atherton, Greater Manchester",
        "postal_code": "M46",
    },
    "chaddesden-derby": {
        "slug": "chaddesden",
        "title": "Jolly's Kafe Chaddesden | Café & Breakfast in Derby",
        "description": "Welcoming café in Chaddesden, Derby. Fresh breakfasts, lunches, homemade food & specialty coffee. Family friendly with daily specials. Open daily.",
        "keywords": "café Chaddesden, coffee shop Derby, breakfast Chaddesden, brunch Derby, café near me Derby, independent café Derby, Chaddesden café",
        "area": "Chaddesden, Derby",
        "postal_code": "DE21",
    },
}

# Route-specific meta tags
ROUTE_META = {
    "/": {
        "title": "Jolly's Kafe | Fresh Food, Great Coffee, Warm Welcome",
        "description": "Jolly's Kafe — independent café with multiple locations across the UK. Fresh breakfasts, lunches, specialty coffee & homemade food. Find your nearest café.",
        "keywords": "Jolly's Kafe, café UK, independent café, breakfast, brunch, coffee shop, Handforth, Middlewich, Timperley, Atherton, Chaddesden",
    },
    "/home-landing": {
        "title": "Jolly's Kafe | Fresh Food, Great Coffee, Warm Welcome",
        "description": "Jolly's Kafe — independent café with multiple locations across the UK. Fresh breakfasts, lunches, specialty coffee & homemade food. Find your nearest café.",
        "keywords": "Jolly's Kafe, café UK, independent café, breakfast, brunch, coffee shop",
    },
    "/menu-catalog": {
        "title": "Menu | Jolly's Kafe — Breakfasts, Lunches & Drinks",
        "description": "Explore the full Jolly's Kafe menu. Fresh breakfasts, sandwiches, paninis, specials, desserts & hot and cold drinks. Something for everyone.",
        "keywords": "Jolly's Kafe menu, café menu, breakfast menu, lunch menu, coffee menu",
    },
    "/contact-us": {
        "title": "Contact Us | Jolly's Kafe",
        "description": "Get in touch with Jolly's Kafe. Find our locations, opening hours, and send us a message. We'd love to hear from you.",
        "keywords": "contact Jolly's Kafe, café locations, opening hours, café phone number",
    },
    "/jklocations": {
        "title": "Our Locations | Jolly's Kafe — Find Your Nearest Café",
        "description": "Find your nearest Jolly's Kafe. Locations in Handforth, Middlewich, Timperley, Atherton & Chaddesden. Fresh food and great coffee at every site.",
        "keywords": "Jolly's Kafe locations, café near me, Handforth café, Middlewich café, Timperley café, Atherton café, Chaddesden café",
    },
    "/table-reservation": {
        "title": "Book a Table | Jolly's Kafe",
        "description": "Reserve a table at Jolly's Kafe. Book online for breakfast, brunch, lunch or afternoon tea at any of our locations.",
        "keywords": "book table café, reserve table Jolly's Kafe, café reservation",
    },
    "/customer-auth": {
        "title": "Sign In | Jolly's Kafe",
        "description": "Sign in or create an account at Jolly's Kafe to order online, track orders, and earn rewards.",
        "keywords": "Jolly's Kafe login, sign in café, create account",
    },
}

# Add location routes to ROUTE_META
for loc_id, seo in LOCATION_SEO.items():
    ROUTE_META[f"/{seo['slug']}"] = {
        "title": seo["title"],
        "description": seo["description"],
        "keywords": seo["keywords"],
    }


def get_meta_for_route(path: str) -> dict:
    """Get SEO meta tags for a given route path"""
    # Exact match
    if path in ROUTE_META:
        return ROUTE_META[path]
    # Strip trailing slash
    clean = path.rstrip("/")
    if clean in ROUTE_META:
        return ROUTE_META[clean]
    # Default
    return ROUTE_META.get("/", {})


def build_jsonld_restaurant(location_id: str = None) -> str:
    """Build JSON-LD structured data for Restaurant schema"""
    import json

    if location_id and location_id in LOCATION_SEO:
        seo = LOCATION_SEO[location_id]
        data = {
            "@context": "https://schema.org",
            "@type": "CafeOrCoffeeShop",
            "name": f"Jolly's Kafe — {seo['area']}",
            "description": seo["description"],
            "url": f"{BASE_URL}/{seo['slug']}",
            "servesCuisine": ["British", "Breakfast", "Café"],
            "priceRange": "£",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": seo["area"].split(",")[0].strip(),
                "addressRegion": seo["area"].split(",")[-1].strip(),
                "postalCode": seo["postal_code"],
                "addressCountry": "GB",
            },
            "openingHoursSpecification": [
                {"@type": "OpeningHoursSpecification", "dayOfWeek": day, "opens": "08:00", "closes": "16:00"}
                for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            ],
        }
    else:
        data = {
            "@context": "https://schema.org",
            "@type": "Restaurant",
            "name": "Jolly's Kafe",
            "description": "Independent café with multiple locations across the UK. Fresh breakfasts, lunches, specialty coffee & homemade food.",
            "url": BASE_URL,
            "servesCuisine": ["British", "Breakfast", "Café"],
            "priceRange": "£",
            "numberOfLocations": 5,
        }
    return json.dumps(data)


def inject_meta_tags(html: str, path: str) -> str:
    """Inject SEO meta tags and JSON-LD into the HTML template"""
    meta = get_meta_for_route(path)
    if not meta:
        return html

    title = meta.get("title", "Jolly's Kafe")
    description = meta.get("description", "")
    keywords = meta.get("keywords", "")
    canonical = f"{BASE_URL}{path}" if path != "/" else BASE_URL

    # Find location_id for JSON-LD
    location_id = None
    for loc_id, seo in LOCATION_SEO.items():
        if path.strip("/") == seo["slug"]:
            location_id = loc_id
            break

    jsonld = build_jsonld_restaurant(location_id)

    # Build meta tags block
    seo_block = f"""<title>{title}</title>
  <meta name="description" content="{description}" />
  <meta name="keywords" content="{keywords}" />
  <link rel="canonical" href="{canonical}" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{description}" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Jolly's Kafe" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{description}" />
  <script type="application/ld+json">{jsonld}</script>"""

    # Remove existing <title> and <meta name="description"> to avoid duplicates
    import re
    html = re.sub(r"<title>.*?</title>", "", html, count=1)
    html = re.sub(r'<meta\s+name="description"\s+content="[^"]*"\s*/?\s*>', "", html, count=1)

    # Inject before </head>
    html = html.replace("</head>", f"  {seo_block}\n  </head>")

    return html


def generate_sitemap() -> str:
    """Generate sitemap.xml content"""
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    urls = [
        {"loc": "/", "priority": "1.0", "changefreq": "weekly"},
        {"loc": "/jklocations", "priority": "0.9", "changefreq": "monthly"},
        {"loc": "/menu-catalog", "priority": "0.8", "changefreq": "weekly"},
        {"loc": "/contact-us", "priority": "0.7", "changefreq": "monthly"},
        {"loc": "/table-reservation", "priority": "0.7", "changefreq": "monthly"},
        {"loc": "/customer-auth", "priority": "0.5", "changefreq": "monthly"},
    ]

    # Add location landing pages
    for loc_id, seo in LOCATION_SEO.items():
        urls.append({"loc": f"/{seo['slug']}", "priority": "0.9", "changefreq": "weekly"})

    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for u in urls:
        xml += f'  <url>\n'
        xml += f'    <loc>{BASE_URL}{u["loc"]}</loc>\n'
        xml += f'    <lastmod>{today}</lastmod>\n'
        xml += f'    <changefreq>{u["changefreq"]}</changefreq>\n'
        xml += f'    <priority>{u["priority"]}</priority>\n'
        xml += f'  </url>\n'
    xml += '</urlset>'
    return xml
