import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "../pages/Home.jsx";
import Ask from "../pages/Ask.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";
import NotFound from "../pages/NotFound.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";

export default function AppRouter(){
  return <Routes>
    <Route path="/" element={<Home/>} />
    <Route path="/ask" element={<ProtectedRoute><Ask/></ProtectedRoute>} />
    <Route path="/login" element={<Login/>} />
    <Route path="/register" element={<Register/>} />
    <Route path="*" element={<NotFound/>} />
  </Routes>;
}
