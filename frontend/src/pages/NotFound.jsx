import React from "react";
import { Link } from "react-router-dom";
export default function NotFound(){
  return <div className="container">
    <h4>404</h4>
    <p>Page introuvable.</p>
    <Link to="/">Accueil</Link>
  </div>;
}
