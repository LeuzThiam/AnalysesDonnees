import React, { useMemo } from "react";
import { Button } from "react-bootstrap";

function toCsv(rows, columns){
  const esc = (s)=>{
    const str = (s ?? "").toString();
    const needs = /[",\n]/.test(str);
    const rep = str.replace(/"/g,'""');
    return needs ? `"${rep}"` : rep;
  };
  const head = columns.map(esc).join(",");
  const body = rows.map(r => columns.map(c => esc(r[c])).join(",")).join("\n");
  return head + "\n" + body;
}

export default function DataTable({ rows = [] }){
  const columns = useMemo(()=>{
    if (!rows || rows.length===0) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  const csv = useMemo(()=> toCsv(rows, columns), [rows, columns]);

  return (
    <div className="table-responsive">
      <div className="d-flex justify-content-end">
        <a
          className="btn btn-sm btn-outline-secondary mb-2"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
          download="resultats.csv"
        >
          Télécharger CSV
        </a>
      </div>
      <table className="table table-sm table-striped">
        <thead>
          <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i)=>(
            <tr key={i}>
              {columns.map(c => <td key={c}>{r[c]?.toString?.() ?? ""}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
