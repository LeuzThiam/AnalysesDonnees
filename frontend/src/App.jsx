import React from "react";
import Navbar from "./components/Navbar.jsx";
import AppRouter from "./router/AppRouter.jsx";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/index.css";
import "./styles/App.css";

export default function App(){
  return <>
    <Navbar />
    <div className="container my-3">
      <AppRouter />
    </div>
  </>;
}
