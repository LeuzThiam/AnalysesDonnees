import React, { useMemo, useRef, useState } from "react";
import { Card, Button } from "react-bootstrap";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from "recharts";

export default function ChartImage({
  title = "Graphique",
  data = [],
  xKey = "name",
  series = [{ key: "value", name: "Valeur", color: "#0d6efd" }],
  type = "line",
  height = 260,
  loading = false,
  error = "",
  grid = true,
  legend = true,
  smooth = true,
  xTickFormatter,
  yTickFormatter,
  tooltipFormatter,
  yDomain = ["auto","auto"],
  referenceZero = false,
}){
  const containerRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const hasData = Array.isArray(data) && data.length > 0;
  const xFmt = xTickFormatter || (v=>String(v));
  const yFmt = yTickFormatter || (v=> typeof v==="number" ? Intl.NumberFormat().format(v) : String(v));
  const tFmt = tooltipFormatter || ((value,name)=>[ typeof value==="number" ? Intl.NumberFormat().format(value) : value, name || "" ]);

  const common = (
    <>
      <XAxis dataKey={xKey} tickFormatter={xFmt} minTickGap={16} />
      <YAxis yAxisId="left" tickFormatter={yFmt} domain={yDomain} />
      {series.some(s=>s.yAxisId==="right") && <YAxis orientation="right" yAxisId="right" tickFormatter={yFmt} domain={yDomain} />}
      {grid && <CartesianGrid strokeDasharray="3 3" />}
      <Tooltip formatter={tFmt} />
      {legend && <Legend />}
      {referenceZero && <ReferenceLine y={0} stroke="#999" />}
    </>
  );

  const content = useMemo(()=>{
    if (loading) return <div className="text-muted" style={{minHeight:height}}>Chargement…</div>;
    if (error) return <div className="text-danger" style={{minHeight:height}}>{error}</div>;
    if (!hasData) return <div className="text-muted" style={{minHeight:height}}>Aucune donnée</div>;

    if (type==="bar"){
      return <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
          {common}
          {series.map((s,i)=><Bar key={s.key} dataKey={s.key} name={s.name||s.key} fill={s.color||palette(i)} yAxisId={s.yAxisId||"left"} maxBarSize={48} />)}
        </BarChart>
      </ResponsiveContainer>;
    }
    if (type==="area"){
      return <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
          {common}
          {series.map((s,i)=><Area key={s.key} dataKey={s.key} name={s.name||s.key} type={smooth?"monotone":"linear"} stroke={s.color||palette(i)} fill={s.color||palette(i)} fillOpacity={0.15} strokeWidth={2} yAxisId={s.yAxisId||"left"} activeDot={{r:4}} />)}
        </AreaChart>
      </ResponsiveContainer>;
    }
    return <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
        {common}
        {series.map((s,i)=><Line key={s.key} dataKey={s.key} name={s.name||s.key} type={smooth?"monotone":"linear"} stroke={s.color||palette(i)} strokeWidth={2} dot={false} yAxisId={s.yAxisId||"left"} activeDot={{r:4}} />)}
      </LineChart>
    </ResponsiveContainer>;
  }, [loading,error,hasData,data,xKey,series,type,height,grid,legend,smooth,xFmt,yFmt,tFmt,yDomain,referenceZero]);

  return <Card className="mb-4 shadow-sm" ref={containerRef}>
    <Card.Body>
      <div className="d-flex justify-content-between align-items-center">
        <Card.Title className="mb-3">{title}</Card.Title>
        <Button variant="light" size="sm" onClick={()=>exportAsPNG(containerRef.current, title)}>Export PNG</Button>
      </div>
      {content}
    </Card.Body>
  </Card>;
}

function palette(i){ const p=["#0d6efd","#6f42c1","#198754","#fd7e14","#dc3545","#20c997","#6610f2"]; return p[i%p.length]; }

async function exportAsPNG(node, filename="chart"){
  if (!node) return; const svg=node.querySelector("svg"); if (!svg) return;
  const s = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([s], { type:"image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image(); img.crossOrigin="anonymous"; img.onload = ()=>{
    const c = document.createElement("canvas"); c.width=img.width; c.height=img.height;
    const ctx=c.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0);
    const a=document.createElement("a"); a.download=`${filename}.png`; a.href=c.toDataURL("image/png"); a.click();
    URL.revokeObjectURL(url);
  }; img.src=url;
}
