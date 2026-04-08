"use client"
import { use } from "react"
import { StockSidebar } from "@/components/stock/stock-sidebar"
import { getStockBySymbol } from "@/lib/stocks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Target, Users } from "lucide-react"

interface Props { params: Promise<{ symbol: string }> }

export default function EstimatesPage({params}:Props) {
  const {symbol}=use(params);const stock=getStockBySymbol(symbol);const price=stock?.price||1000
  const consensus=[{l:"Strong Buy",c:12,p:40,cl:"#10B981"},{l:"Buy",c:8,p:27,cl:"#34D399"},{l:"Hold",c:7,p:23,cl:"#FBBF24"},{l:"Sell",c:2,p:7,cl:"#F87171"},{l:"Strong Sell",c:1,p:3,cl:"#EF4444"}]
  const targets=[{l:"High",v:(price*1.35).toFixed(2),cl:"#10B981"},{l:"Median",v:(price*1.18).toFixed(2),cl:"#34D399"},{l:"Average",v:(price*1.15).toFixed(2),cl:"#FBBF24"},{l:"Low",v:(price*0.85).toFixed(2),cl:"#F87171"}]
  return(
    <div className="flex min-h-screen bg-background"><StockSidebar/><div className="flex flex-1 flex-col pl-[260px]"><main className="flex-1 p-6 space-y-6">
      <div><h1 className="text-2xl font-bold">{symbol} Estimates</h1><p className="text-sm text-muted-foreground">Analyst consensus & price targets</p></div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Users size={20}/>Analyst Consensus</CardTitle></CardHeader><CardContent className="space-y-3">{consensus.map(c=><div key={c.l}><div className="flex justify-between text-sm mb-1"><span>{c.l}</span><span className="text-muted-foreground">{c.c} ({c.p}%)</span></div><div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full" style={{width:`${c.p}%`,backgroundColor:c.cl}}/></div></div>)}</CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Target size={20}/>Price Targets</CardTitle></CardHeader><CardContent><div className="mb-4 rounded-lg bg-primary/5 border border-primary/20 p-4 text-center"><p className="text-xs text-muted-foreground mb-1">Current</p><p className="text-2xl font-bold">₹{price.toFixed(2)}</p></div><div className="space-y-3">{targets.map(t=><div key={t.l} className="flex justify-between items-center rounded-lg bg-secondary/30 px-4 py-3"><span className="text-sm">{t.l}</span><span className="font-semibold" style={{color:t.cl}}>₹{t.v}</span></div>)}</div></CardContent></Card>
      </div>
    </main></div></div>)
}
