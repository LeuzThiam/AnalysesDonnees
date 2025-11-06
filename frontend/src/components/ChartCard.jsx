import React, { useMemo, useRef, useState } from "react";
import { Card, Button } from "react-bootstrap";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine,
} from "recharts";

/**
 * Generic chart card using recharts.
 *
 * Props:
 * - title: string
 * - data: array of objects
 * - xKey: string (default: "name")
 * - series: [{ key, name?, color?, yAxisId? ("left"|"right") }]
 * - type: "line" | "bar" | "area" (default: "line")
 * - height: number (default: 260)
 * - loading: bool
 * - error: string
 * - grid: bool (default: true)
 * - legend: bool (default: true)
 * - smooth: bool (default: true) for line/area
 * - xTickFormatter(value) -> string
 * - yTickFormatter(value) -> string
 * - tooltipFormatter(value, name, entry, index) -> [val, label]
 * - yDomain: ["auto","auto"] or [min, max]
 * - referenceZero: bool (default: false)
 */
export default function ChartCart({
  title = "Chart",
  data = [],
  xKey = "name",
  series = [{ key: "value", name: "Value", color: "#0d6efd" }],
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
  yDomain = ["auto", "auto"],
  referenceZero = false,
}) {
  const containerRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  const hasData = Array.isArray(data) && data.length > 0;

  const defaultXFormatter = (v) => String(v);
  const defaultYFormatter = (v) =>
    typeof v === "number" ? Intl.NumberFormat().format(v) : String(v);

  const xFmt = xTickFormatter || defaultXFormatter;
  const yFmt = yTickFormatter || defaultYFormatter;

  const tFmt = tooltipFormatter || ((value, name) => {
    const label = name ?? "";
    const val = typeof value === "number" ? Intl.NumberFormat().format(value) : value;
    return [val, label];
  });

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="text-muted d-flex align-items-center gap-2" style={{ minHeight: height }}>
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          <span>Loading…</span>
        </div>
      );
    }
    if (error) {
      return <div className="text-danger" style={{ minHeight: height }}>{error}</div>;
    }
    if (!hasData) {
      return <div className="text-muted" style={{ minHeight: height }}>No data</div>;
    }

    const commonAxes = (
      <>
        <XAxis dataKey={xKey} tickFormatter={xFmt} minTickGap={16} />
        <YAxis yAxisId="left" tickFormatter={yFmt} domain={yDomain} />
        {series.some(s => s.yAxisId === "right") && (
          <YAxis orientation="right" yAxisId="right" tickFormatter={yFmt} domain={yDomain} />
        )}
        {grid && <CartesianGrid strokeDasharray="3 3" />}
        <Tooltip formatter={tFmt} />
        {legend && <Legend />}
        {referenceZero && <ReferenceLine y={0} stroke="#999" />}
      </>
    );

    if (type === "bar") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            {commonAxes}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name || s.key}
                fill={s.color || defaultColorAt(i)}
                yAxisId={s.yAxisId || "left"}
                maxBarSize={48}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (type === "area") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            {commonAxes}
            {series.map((s, i) => (
              <Area
                key={s.key}
                dataKey={s.key}
                name={s.name || s.key}
                type={smooth ? "monotone" : "linear"}
                stroke={s.color || defaultColorAt(i)}
                fill={s.color || defaultColorAt(i)}
                fillOpacity={0.15}
                strokeWidth={2}
                yAxisId={s.yAxisId || "left"}
                activeDot={{ r: 4 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // default: line
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          {commonAxes}
          {series.map((s, i) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.name || s.key}
              type={smooth ? "monotone" : "linear"}
              stroke={s.color || defaultColorAt(i)}
              strokeWidth={2}
              dot={false}
              yAxisId={s.yAxisId || "left"}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loading, error, hasData, data, xKey, series, type, height,
    grid, legend, smooth, xFmt, yFmt, tFmt, yDomain, referenceZero
  ]);

  return (
    <Card className="mb-4 shadow-sm" ref={containerRef}>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center">
          <Card.Title className="mb-3">{title}</Card.Title>
          <Button variant="light" size="sm" onClick={() => exportAsPNG(containerRef.current, title)}>
            Export PNG
          </Button>
        </div>
        {content}
      </Card.Body>
    </Card>
  );
}

function defaultColorAt(i) {
  const palette = ["#0d6efd", "#6f42c1", "#198754", "#fd7e14", "#dc3545", "#20c997", "#6610f2"];
  return palette[i % palette.length];
}

// simple SVG -> PNG export (good enough for most cases)
async function exportAsPNG(node, filename = "chart") {
  if (!node) return;
  const svg = node.querySelector("svg");
  if (!svg) return;

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svg);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    URL.revokeObjectURL(url);
  };
  img.src = url;
}
