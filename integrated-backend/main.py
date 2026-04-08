from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from stock_service import get_stock_history, get_stock_price
from technical_service import get_indicators, get_candlestick_pattern, get_crossovers
from signal_service import generate_signal
from financial_service import get_stock_info, get_financials, get_estimates
import json
import os

app = FastAPI(title="SparkleAI Investment Backend", version="4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EARNINGS_OUTPUTS = os.path.join(os.path.dirname(__file__), "outputs")
if os.path.exists(EARNINGS_OUTPUTS):
    app.mount("/data", StaticFiles(directory=EARNINGS_OUTPUTS), name="earnings-data")


def find_company_folder(company: str) -> str | None:
    """Find the exact outputs folder for a company by exact then case-insensitive match."""
    if not os.path.isdir(EARNINGS_OUTPUTS):
        return None
    needle = company.lower().replace("_", " ").strip()
    exact = None
    partial = None
    for entry in os.listdir(EARNINGS_OUTPUTS):
        if not os.path.isdir(os.path.join(EARNINGS_OUTPUTS, entry)):
            continue
        entry_lower = entry.lower()
        if entry_lower == needle:
            return entry          # exact match wins immediately
        if needle in entry_lower and exact is None:
            partial = entry
        elif entry_lower in needle and exact is None:
            partial = partial or entry
    return partial


@app.get("/")
def home():
    return {"message": "SparkleAI v4.0", "companies": 49, "total_analyses": 231}


# ═══ TECHNICAL ═══

@app.get("/price/{ticker}")
def price(ticker: str):
    return get_stock_price(ticker)

@app.get("/technical/{ticker}")
def technical_analysis(ticker: str):
    df = get_stock_history(ticker)
    indicators = get_indicators(df)
    indicators["candle"] = get_candlestick_pattern(df)
    indicators["crossovers"] = get_crossovers(df)
    return indicators

@app.get("/signal/{ticker}")
def signal(ticker: str):
    df = get_stock_history(ticker)
    indicators = get_indicators(df)
    indicators["candle"] = get_candlestick_pattern(df)
    indicators["crossovers"] = get_crossovers(df)
    return generate_signal(indicators)

@app.get("/full/{ticker}")
def full_analysis(ticker: str):
    df = get_stock_history(ticker)
    indicators = get_indicators(df)
    indicators["candle"] = get_candlestick_pattern(df)
    indicators["crossovers"] = get_crossovers(df)
    sig = generate_signal(indicators)
    return {"indicators": indicators, "signal": sig}


# ═══ FUNDAMENTAL (Earnings Call Data) ═══

@app.get("/fundamental/manifest")
def get_manifest():
    p = os.path.join(EARNINGS_OUTPUTS, "manifest.json")
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"error": "Manifest not found"}

@app.get("/fundamental/{company}/list")
def list_company_reports(company: str):
    """Return available Earnings Calls (EC) and Annual Reports (AR) for a company."""
    folder = find_company_folder(company)
    if not folder:
        return {"company": company, "earnings_calls": [], "annual_reports": []}

    def _periods(cat: str):
        path = os.path.join(EARNINGS_OUTPUTS, folder, cat)
        if not os.path.isdir(path):
            return []
        return sorted(
            [p for p in os.listdir(path) if os.path.isdir(os.path.join(path, p))],
            reverse=True
        )

    return {
        "company": folder,
        "earnings_calls": [{"period": p, "label": p} for p in _periods("EC")],
        "annual_reports":  [{"period": p, "label": p} for p in _periods("AR")],
    }

@app.get("/fundamental/{company}/{category}/{period}")
def get_beginner_analysis(company: str, category: str, period: str):
    """Return beginner.json for outputs/{company}/{category}/{period}/."""
    folder = find_company_folder(company)
    if not folder:
        return {"error": f"Company '{company}' not found"}
    cat = category.upper()
    fp = os.path.join(EARNINGS_OUTPUTS, folder, cat, period, "beginner.json")
    if not os.path.exists(fp):
        return {"error": f"No data for {company} / {category} / {period}"}
    with open(fp, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/fundamental/{company}")
def get_company_analyses(company: str):
    p = os.path.join(EARNINGS_OUTPUTS, "manifest.json")
    if not os.path.exists(p):
        return {"error": "Manifest not found"}
    with open(p, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    results = [e for e in manifest.get("analyses", []) if company.lower() in e.get("company", "").lower()]
    results.sort(key=lambda x: (x.get("fiscal_year") or "", x.get("quarter") or ""), reverse=True)
    return {"company": company, "total": len(results), "analyses": results}

@app.get("/fundamental/{company}/{quarter_fy}")
def get_quarter_analysis(company: str, quarter_fy: str):
    company_folder = company.replace(" ", "_")
    output_dir = os.path.join(EARNINGS_OUTPUTS, company_folder, quarter_fy)
    if not os.path.exists(output_dir):
        output_dir = os.path.join(EARNINGS_OUTPUTS, company, quarter_fy)
    if not os.path.exists(output_dir):
        return {"error": f"No analysis found for {company} {quarter_fy}"}

    result = {}
    files = {"esg": "esg_analysis.json", "sentiment": "sentiment_analysis.json",
             "speaker": "speaker_analysis.json", "summary": "summary_analysis.json",
             "metrics": "metrics.json"}
    for key, filename in files.items():
        filepath = os.path.join(output_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                result[key] = json.load(f)

    report_path = os.path.join(output_dir, "summary_report.md")
    if os.path.exists(report_path):
        with open(report_path, "r", encoding="utf-8") as f:
            result["report_markdown"] = f.read()

    manifest_path = os.path.join(EARNINGS_OUTPUTS, "manifest.json")
    if os.path.exists(manifest_path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        for entry in manifest.get("analyses", []):
            ef = entry.get("company", "").replace(" ", "_")
            eq = (entry.get("quarter") or "") + "_" + (entry.get("fiscal_year") or "")
            if ef == company_folder and eq == quarter_fy:
                result["headline"] = entry.get("headline", {})
                result["quarter"] = entry.get("quarter")
                result["fiscal_year"] = entry.get("fiscal_year")
                break
    return result


# ═══ REPORTS LIST ═══

@app.get("/reports/list")
def list_reports():
    """Recursively scan outputs/ for report.pdf files and return metadata + URL."""
    reports = []
    if not os.path.isdir(EARNINGS_OUTPUTS):
        return {"total": 0, "reports": []}
    for company in sorted(os.listdir(EARNINGS_OUTPUTS)):
        company_path = os.path.join(EARNINGS_OUTPUTS, company)
        if not os.path.isdir(company_path):
            continue
        for category in ("EC", "AR"):
            cat_path = os.path.join(company_path, category)
            if not os.path.isdir(cat_path):
                continue
            for period in sorted(os.listdir(cat_path)):
                period_path = os.path.join(cat_path, period)
                if not os.path.isdir(period_path):
                    continue
                if os.path.exists(os.path.join(period_path, "report.pdf")):
                    pdf_url = f"/data/{urllib.request.quote(company)}/{category}/{urllib.request.quote(period)}/report.pdf"
                    reports.append({
                        "company_name": company,
                        "category": category,
                        "period": period,
                        "pdf_url": pdf_url,
                    })
    return {"total": len(reports), "reports": reports}


# ═══ NEW: METRICS ENDPOINTS ═══

@app.get("/metrics/{company}")
def get_company_metrics(company: str):
    p = os.path.join(EARNINGS_OUTPUTS, "all_metrics.json")
    if not os.path.exists(p):
        return {"error": "all_metrics.json not found"}
    with open(p, "r", encoding="utf-8") as f:
        all_data = json.load(f)
    results = [e for e in all_data if company.lower() in e.get("company", "").lower()]
    results.sort(key=lambda x: (x.get("fiscal_year") or "", x.get("quarter") or ""), reverse=True)
    return {"company": company, "total": len(results), "quarters": results}

@app.get("/metrics/{company}/{quarter_fy}")
def get_quarter_metrics(company: str, quarter_fy: str):
    cf = company.replace(" ", "_")
    p = os.path.join(EARNINGS_OUTPUTS, cf, quarter_fy, "metrics.json")
    if not os.path.exists(p):
        p = os.path.join(EARNINGS_OUTPUTS, company, quarter_fy, "metrics.json")
    if not os.path.exists(p):
        return {"error": f"No metrics for {company} {quarter_fy}"}
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/all-metrics")
def get_all_metrics():
    p = os.path.join(EARNINGS_OUTPUTS, "all_metrics.json")
    if not os.path.exists(p):
        return {"error": "all_metrics.json not found"}
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/companies")
def get_all_companies():
    p = os.path.join(EARNINGS_OUTPUTS, "manifest.json")
    if not os.path.exists(p):
        return {"error": "Manifest not found"}
    with open(p, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    companies = {}
    for entry in manifest.get("analyses", []):
        name = entry.get("company", "")
        if name not in companies:
            companies[name] = {"name": name, "folder": name.replace(" ", "_"), "quarters": [], "latest_headline": None}
        qfy = f"{entry.get('quarter') or ''}_{entry.get('fiscal_year') or ''}"
        companies[name]["quarters"].append(qfy)
        if companies[name]["latest_headline"] is None:
            companies[name]["latest_headline"] = entry.get("headline", {})
    result = sorted(companies.values(), key=lambda x: x["name"])
    return {"total": len(result), "companies": result}


# ═══ FINANCIAL DATA (yfinance) ═══

@app.get("/stock-info/{ticker}")
def stock_info(ticker: str):
    return get_stock_info(ticker)

@app.get("/financials/{ticker}")
def financials(ticker: str):
    return get_financials(ticker)

@app.get("/estimates/{ticker}")
def estimates(ticker: str):
    return get_estimates(ticker)

@app.get("/stock-complete/{ticker}")
def stock_complete(ticker: str):
    info = get_stock_info(ticker)
    try:
        df = get_stock_history(ticker)
        ind = get_indicators(df)
        ind["candle"] = get_candlestick_pattern(df)
        ind["crossovers"] = get_crossovers(df)
        technical = {"indicators": ind, "signal": generate_signal(ind)}
    except Exception as e:
        technical = {"error": str(e)}
    try:
        fin = get_financials(ticker)
    except Exception as e:
        fin = {"error": str(e)}
    try:
        est = get_estimates(ticker)
    except Exception as e:
        est = {"error": str(e)}
    return {"info": info, "technical": technical, "financials": fin, "estimates": est}


# ═══ NEWS ENDPOINT (Google News RSS — category-based) ═══

import xml.etree.ElementTree as ET
from datetime import datetime, timezone
import urllib.request
import re

def parse_time_ago(pub_date_str):
    try:
        dt = datetime.strptime(pub_date_str.strip(), "%a, %d %b %Y %H:%M:%S %Z")
        dt = dt.replace(tzinfo=timezone.utc)
        diff = datetime.now(timezone.utc) - dt
        mins = int(diff.total_seconds() / 60)
        if mins < 60:
            return f"{mins} min ago"
        hours = mins // 60
        if hours < 24:
            return f"{hours} hr ago"
        days = hours // 24
        return f"{days}d ago"
    except:
        return "recently"

def parse_pub_date(pub_date_str):
    """Returns datetime object or None"""
    try:
        dt = datetime.strptime(pub_date_str.strip(), "%a, %d %b %Y %H:%M:%S %Z")
        return dt.replace(tzinfo=timezone.utc)
    except:
        return None

def fetch_rss(query, category, count=2):
    try:
        # Add 'when:1d' to force results from last 24 hours
        full_query = f"{query} when:1d"
        url = f"https://news.google.com/rss/search?q={urllib.request.quote(full_query)}&hl=en-IN&gl=IN&ceid=IN:en"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        response = urllib.request.urlopen(req, timeout=8)
        xml_data = response.read().decode("utf-8")
        root = ET.fromstring(xml_data)

        articles = []
        seen_titles = set()
        now = datetime.now(timezone.utc)

        for item in root.findall(".//item"):
            if len(articles) >= count:
                break
            title = item.findtext("title", "")
            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")
            source_match = re.search(r" - (.+)$", title)
            source = source_match.group(1) if source_match else "Google News"
            clean_title = re.sub(r" - [^-]+$", "", title).strip()

            # Skip old articles (older than 48 hours)
            dt = parse_pub_date(pub_date)
            if dt:
                age_hours = (now - dt).total_seconds() / 3600
                if age_hours > 48:
                    continue

            # Skip duplicates
            title_key = clean_title[:50].lower()
            if title_key in seen_titles:
                continue
            seen_titles.add(title_key)

            articles.append({
                "title": clean_title,
                "link": link,
                "source": source,
                "time": parse_time_ago(pub_date),
                "category": category,
                "_dt": dt,
            })
        return articles
    except:
        return []

@app.get("/news")
def get_news():
    try:
        categories = [
            ("stock market India today Nifty Sensex", "Market", 2),
            ("RBI SEBI policy regulation India today", "Policy", 1),
            ("India company quarterly results earnings today", "Earnings", 1),
            ("IT banking pharma auto sector stocks India today", "Sector", 1),
            ("crude oil gold commodity price India today", "Commodities", 1),
            ("FII DII buying selling India stocks today", "Market", 1),
            ("IPO listing India stock exchange today", "Market", 1),
        ]

        all_articles = []
        seen = set()
        for query, category, count in categories:
            items = fetch_rss(query, category, count)
            for item in items:
                key = item["title"][:50].lower()
                if key not in seen:
                    seen.add(key)
                    all_articles.append(item)

        # Sort by most recent first
        all_articles.sort(key=lambda x: x.get("_dt") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

        # Remove internal _dt field before returning
        for a in all_articles:
            a.pop("_dt", None)

        return {"articles": all_articles[:8], "count": len(all_articles[:8])}
    except Exception as e:
        return {"articles": [], "error": str(e)}
