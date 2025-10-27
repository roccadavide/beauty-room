import { useEffect, useState } from "react";
import { Container, Nav, Navbar, NavDropdown } from "react-bootstrap";
import { PersonCircle } from "react-bootstrap-icons";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import CartIcon from "../../features/cart/CartIcon";
import { persistor } from "../../app/store";
import { logout } from "../../features/auth/slices/auth.slice";

const LINKS = [
  { to: "/prodotti", label: "Prodotti" },
  { to: "/trattamenti", label: "Trattamenti" },
  { to: "/risultati", label: "Risultati" },
  { to: "/chisono", label: "Chi sono" },
  { to: "/promozioni", label: "Promozioni" },
];

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { user } = useSelector(s => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("nav-open", expanded);
    return () => document.body.classList.remove("nav-open");
  }, [expanded]);

  useEffect(() => {
    setExpanded(false);
  }, [location.pathname]);

  const closeMenu = () => setExpanded(false);

  return (
    <Navbar
      expand="md"
      fixed="top"
      expanded={expanded}
      onToggle={() => setExpanded(prev => !prev)}
      className={`site-nav ${scrolled ? "is-scrolled" : "is-top"}`}
    >
      <Container fluid className="px-3 position-relative d-flex align-items-center container-navbar">
        {/* Logo */}
        <Navbar.Brand as={Link} to="/" onClick={closeMenu} className="d-flex align-items-center brand-wrap">
          <img src="/logo.png" className="logo" alt="Beauty Room" />
        </Navbar.Brand>

        {/* Toggler (mobile) */}
        <div className="navbar-center-toggle d-md-none">
          <Navbar.Toggle aria-controls="mainNav" className="shadow-none">
            <span className="navbar-toggler-icon" />
          </Navbar.Toggle>
        </div>

        {/* Link principali */}
        <Navbar.Collapse id="mainNav" className="mobile-overlay">
          <Nav className="mx-md-auto my-3 my-md-0 gap-md-4 text-center">
            {LINKS.map(({ to, label }) => (
              <Nav.Link key={to} as={NavLink} to={to} end className="nav-link-animated">
                {label}
              </Nav.Link>
            ))}
          </Nav>
        </Navbar.Collapse>

        {/* Area destra */}
        <div className="nav-right ms-auto">
          <NavDropdown
            align="end"
            title={
              <span className="user-dropdown">
                <PersonCircle size={24} className="user-icon" />
              </span>
            }
            id="navbar-user-dropdown"
            className="user-menu"
          >
            {user ? (
              <>
                <NavDropdown.Header className="text-black fw-semibold">Ciao, {user.name}!</NavDropdown.Header>
                <NavDropdown.Item onClick={() => navigate("/mioprofilo")}>Il mio profilo</NavDropdown.Item>
                <NavDropdown.Item onClick={() => navigate(user.role === "ADMIN" ? "/prenotazioni/tutte" : "/prenotazioni")}>
                  {user.role === "ADMIN" ? "Visualizza prenotazioni" : "Le mie prenotazioni"}
                </NavDropdown.Item>
                <NavDropdown.Item onClick={() => navigate(user.role === "ADMIN" ? "/ordini/tutti" : "/ordini")}>
                  {user.role === "ADMIN" ? "Visualizza ordini" : "I miei ordini"}
                </NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item
                  onClick={() => {
                    dispatch(logout());
                    persistor.purge();
                    navigate("/");
                  }}
                >
                  Logout
                </NavDropdown.Item>
              </>
            ) : (
              <>
                <NavDropdown.Item as={Link} to="/login">
                  Accedi
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/register">
                  Registrati
                </NavDropdown.Item>
              </>
            )}
          </NavDropdown>

          <CartIcon />
        </div>
      </Container>
    </Navbar>
  );
}
