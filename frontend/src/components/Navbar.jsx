import React from "react";
import { Container, Nav, Navbar as RBNavbar } from "react-bootstrap";
import { NavLink } from "react-router-dom";

export default function Navbar(){
  const link = ({ isActive }) => "nav-link" + (isActive ? " active fw-semibold" : "");
  return <RBNavbar bg="light" expand="md" className="border-bottom">
    <Container>
      <RBNavbar.Brand>Universal Analytics</RBNavbar.Brand>
      <RBNavbar.Toggle aria-controls="nav" />
      <RBNavbar.Collapse id="nav">
        <Nav className="me-auto">
          <NavLink to="/" className={link}>Accueil</NavLink>
          <NavLink to="/ask" className={link}>Question</NavLink>
        </Nav>
      </RBNavbar.Collapse>
    </Container>
  </RBNavbar>;
}
