"use client"

import { useState, useEffect } from "react"
import {
  Target, Brain, Leaf, Users, FileText, AlertTriangle,
  TrendingUp, Lightbulb, Shield, Eye, MessageSquare, Loader2,
  BarChart2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface FundamentalAnalysisProps {
  symbol: string
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// Stock symbol → company folder name (must match outputs/ directory names exactly)
const MAP: Record<string, string> = {
  ADANIENT:    "Adani Enterprises",
  ADANIPORTS:  "Adani Ports & Special Economic Zone",
  APOLLOHOSP:  "Apollo Hospitals",
  AXISBANK:    "Axis Bank",
  BPCL:        "BPCL",
  "BAJAJ-AUTO":"Bajaj Auto",
  BAJFINANCE:  "Bajaj Finance",
  BAJAJFINSV:  "Bajaj Finserv",
  BEL:         "Bharat Electronics",
  BHARTIARTL:  "Bharti Airtel",
  BRITANNIA:   "Britannia Industries",
  CIPLA:       "Cipla",
  COALINDIA:   "Coal India",
  DIVISLAB:    "Divi's Laboratories",
  DRREDDY:     "Dr Reddys Laboratories",
  EICHERMOT:   "Eicher Motors",
  ETERNAL:     "Eternal",
  GRASIM:      "Grasim Industries",
  HCLTECH:     "HCL Technologies",
  HDFCBANK:    "HDFC Bank",
  HDFCLIFE:    "HDFC Life Insurance Company",
  HEROMOTOCO:  "Hero MotoCorp",
  HINDALCO:    "Hindalco",
  HINDUNILVR:  "Hindustan Unilever",
  ICICIBANK:   "ICICI Bank",
  ITC:         "ITC",
  INDUSINDBK:  "IndusInd Bank",
  INFY:        "Infosys",
  INDIGO:      "Interglobe Aviation",
  JSWSTEEL:    "JSW Steel",
  JIOFIN:      "Jio Financial Services",
  KOTAKBANK:   "Kotak Mahindra Bank",
  LTIM:        "LTIMindtree",
  LT:          "Larsen & Toubro",
  "M&M":       "Mahindra & Mahindra",
  MARUTI:      "Maruti Suzuki India",
  MAXHEALTH:   "Max Healthcare Institute",
  NTPC:        "NTPC",
  NESTLEIND:   "Nestle India",
  ONGC:        "ONGC",
  POWERGRID:   "Power Grid Corporation of India",
  RELIANCE:    "Reliance Industries",
  SBILIFE:     "SBI Life Insurance Company",
  SHRIRAMFIN:  "Shriram Finance",
  SBIN:        "State Bank of India",
  SUNPHARMA:   "Sun Pharmaceutical Industries",
  TCS:         "TCS",
  TATACONSUM:  "Tata Consumer Products",
  TATAMOTORS:  "Tata Motors Passenger Vehicles",
  TATASTEEL:   "Tata Steel",
  TECHM:       "Tech Mahindra",
  TITAN:       "Titan Company",
  TRENT:       "Trent",
  UPL:         "UPL",
  ULTRACEMCO:  "UltraTech Cement",
  WIPRO:       "Wipro",
}

const SECTION_META: Record<string, { icon: React.ElementType; color: string }> = {
  financial_metrics:   { icon: TrendingUp,    color: "#34D399" },
  risk_intelligence:   { icon: AlertTriangle,  color: "#F87171" },
  esg:                 { icon: Leaf,           color: "#10B981" },
  speaker_sentiment:   { icon: MessageSquare,  color: "#60A5FA" },
  qa_transparency:     { icon: Eye,            color: "#A78BFA" },
  overall_sentiment:   { icon: Target,         color: "#06B6D4" },
  investment_synthesis:{ icon: Lightbulb,      color: "#F59E0B" },
  capital_structure:   { icon: Shield,         color: "#8B5CF6" },
  management_discussion:{ icon: FileText,      color: "#64748B" },
  strategy:            { icon: Brain,          color: "#EC4899" },
}

function scoreColor(v: number) {
  return v >= 70 ? "#34D399" : v >= 40 ? "#FBBF24" : "#F87171"
}

async function safeFetch(url: string) {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const t = await r.text()
    try { return JSON.parse(t) } catch { return null }
  } catch { return null }
}

type Category = "EC" | "AR"
interface ReportItem { period: string; label: string }
interface ReportList { earnings_calls: ReportItem[]; annual_reports: ReportItem[] }

export function FundamentalAnalysis({ symbol }: FundamentalAnalysisProps) {
  const [reportList, setReportList] = useState<ReportList>({ earnings_calls: [], annual_reports: [] })
  const [activeCategory, setActiveCategory] = useState<Category>("EC")
  const [selectedPeriod, setSelectedPeriod] = useState("")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const company = MAP[symbol] || symbol

  // Fetch available reports list
  useEffect(() => {
    (async () => {
      setLoading(true)
      const res = await safeFetch(`${API}/fundamental/${encodeURIComponent(company)}/list`)
      if (res) {
        const list: ReportList = {
          earnings_calls: res.earnings_calls || [],
          annual_reports: res.annual_reports || [],
        }
        setReportList(list)
        // Default: first earnings call, or fall back to first annual report
        if (list.earnings_calls.length > 0) {
          setActiveCategory("EC")
          setSelectedPeriod(list.earnings_calls[0].period)
        } else if (list.annual_reports.length > 0) {
          setActiveCategory("AR")
          setSelectedPeriod(list.annual_reports[0].period)
        }
      }
      setLoading(false)
    })()
  }, [company])

  // Fetch detail when category or period changes
  useEffect(() => {
    if (!selectedPeriod) return
    ;(async () => {
      setLoading(true)
      const res = await safeFetch(
        `${API}/fundamental/${encodeURIComponent(company)}/${activeCategory}/${encodeURIComponent(selectedPeriod)}`
      )
      setData(res && !res.error ? res : null)
      setLoading(false)
    })()
  }, [selectedPeriod, activeCategory, company])

  const activePeriods = activeCategory === "EC" ? reportList.earnings_calls : reportList.annual_reports

  const handleCategorySwitch = (cat: Category) => {
    setActiveCategory(cat)
    const periods = cat === "EC" ? reportList.earnings_calls : reportList.annual_reports
    if (periods.length > 0) setSelectedPeriod(periods[0].period)
    else setSelectedPeriod("")
  }

  // ─── Loading / empty states ───────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
      <Loader2 size={20} className="animate-spin" /> Loading analysis...
    </div>
  )

  const hasAny = reportList.earnings_calls.length > 0 || reportList.annual_reports.length > 0
  if (!hasAny) return (
    <div className="text-center py-20 text-muted-foreground">No fundamental data available for {symbol}</div>
  )

  // ─── Derived data from beginner.json ──────────────────────────────────────
  const sections: Record<string, any> = data?.sections || {}
  const synthesis = sections.investment_synthesis || sections.overall_sentiment
  const synthScore = synthesis?.score ?? 0
  const synthLabel = synthesis?.label ?? "N/A"
  const docType = data?.doc_type || activeCategory.toLowerCase()
  const categoryLabel = activeCategory === "EC" ? "Earnings Call" : "Annual Report"

  return (
    <div className="space-y-6">

      {/* ─── Category tabs + period selector ─────────────────────────────── */}
      <div className="space-y-3">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-secondary p-1 w-fit">
          {(
            [
              { key: "EC" as Category, label: "Earnings Calls", count: reportList.earnings_calls.length },
              { key: "AR" as Category, label: "Annual Reports",  count: reportList.annual_reports.length },
            ] as const
          )
            .filter(t => t.count > 0)
            .map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => handleCategorySwitch(key)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                  activeCategory === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                <span className="ml-1.5 text-xs opacity-50">({count})</span>
              </button>
            ))}
        </div>

        {/* Period buttons */}
        <div className="flex flex-wrap gap-2">
          {activePeriods.map(item => (
            <button
              key={item.period}
              onClick={() => setSelectedPeriod(item.period)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                selectedPeriod === item.period
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="text-center py-12 text-muted-foreground">No data for this period.</div>
      ) : (
        <>
          {/* ─── Overall Score gauge ────────────────────────────────────────── */}
          {synthesis && (
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <p className="text-xs font-semibold tracking-[3px] text-muted-foreground mb-6">
                    {categoryLabel.toUpperCase()} — {selectedPeriod}
                  </p>
                  <div className="relative h-40 w-40 mb-4">
                    <svg className="h-40 w-40 -rotate-90 transform" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="64" fill="none" stroke="currentColor" strokeWidth="12" className="text-secondary" />
                      <circle
                        cx="80" cy="80" r="64" fill="none"
                        stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round"
                        strokeDasharray={`${(synthScore / 100) * 402.1} 402.1`}
                      />
                      <defs>
                        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#34D399" />
                          <stop offset="100%" stopColor="#06B6D4" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold">{Math.round(synthScore)}</span>
                      <span className="text-xs text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold"
                    style={{ backgroundColor: scoreColor(synthScore) + "20", color: scoreColor(synthScore) }}>
                    <Lightbulb size={16} />{synthLabel}
                  </div>
                  {synthesis.bullets?.length > 0 && (
                    <div className="mt-4 max-w-md space-y-1">
                      {synthesis.bullets.map((b: string, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground leading-relaxed">{b}</p>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Section cards ───────────────────────────────────────────────── */}
          {Object.entries(sections).filter(([k]) => k !== "investment_synthesis" && k !== "overall_sentiment").length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart2 size={20} className="text-primary" /> Analysis Breakdown
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {Object.keys(sections).length} dimensions scored 0–100
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(sections)
                    .filter(([k]) => k !== "investment_synthesis")
                    .map(([key, sec]: [string, any]) => {
                      const meta = SECTION_META[key]
                      const Icon = meta?.icon ?? BarChart2
                      const accent = meta?.color ?? scoreColor(sec.score)
                      const bar = scoreColor(sec.score)
                      return (
                        <div key={key} className="rounded-lg border border-border p-4 space-y-3">
                          {/* Header row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon size={15} style={{ color: accent }} />
                              <span className="text-sm font-medium">{sec.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold" style={{ color: bar }}>
                                {sec.label}
                              </span>
                              <span className="text-sm font-bold">{Math.round(sec.score)}</span>
                            </div>
                          </div>
                          {/* Score bar */}
                          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${sec.score}%`, backgroundColor: bar }}
                            />
                          </div>
                          {/* Bullets */}
                          {sec.bullets?.length > 0 && (
                            <ul className="space-y-1">
                              {sec.bullets.map((b: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                                  {b}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
