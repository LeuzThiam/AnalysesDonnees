import React, { useMemo, useRef, useState } from "react";
import { Button, ButtonGroup } from "react-bootstrap";

export default function SqlPreview({ sql="", rationale="" }){
  const [expanded, setExpanded] = useState(true);
  const linkRef = useRef(null);
  const blobUrl = useMemo(()=>{
    if (!sql) return "";
    const b=new Blob([sql], { type:"text/sql" });
    return URL.createObjectURL(b);
  }, [sql]);

  const copy = async ()=>{
    try{ await navigator.clipboard.writeText(sql); alert("SQL copié"); }
    catch{ alert("Impossible de copier"); }
  };

  if (!sql) return null;
  return <div className="card p-3">
    <div className="d-flex justify-content-between align-items-center">
      <h5 className="m-0">SQL</h5>
      <ButtonGroup size="sm">
        <Button variant="outline-secondary" onClick={copy}>Copier</Button>
        <a ref={linkRef} href={blobUrl} download="requete.sql" className="btn btn-outline-secondary">Télécharger</a>
        <Button variant="dark" onClick={()=>setExpanded(e=>!e)}>{expanded?"Replier":"Afficher"}</Button>
      </ButtonGroup>
    </div>
    {expanded && (<>
      <pre className="mt-2 mb-2">{sql}</pre>
      {rationale && <div className="text-muted">{rationale}</div>}
    </>)}
  </div>;
}
