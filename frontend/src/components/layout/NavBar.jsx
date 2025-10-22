import { useEffect, useState } from "react";
import { Container, Nav, Navbar, NavDropdown } from "react-bootstrap";
import { PersonCircle } from "react-bootstrap-icons";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import CartIcon from "../../features/cart/CartIcon";
import { persistor } from "../../app/store";
import { logout } from "../../features/auth/slices/auth.slice";

const NavBar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { user } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setExpanded(false);

  return (
    <Navbar
      expand="md"
      fixed="top"
      expanded={expanded}
      onToggle={() => setExpanded(prev => !prev)}
      className={scrolled ? "navbar navbar-solid" : "navbar navbar-gradient"}
    >
      <Container fluid className="px-3 position-relative d-flex align-items-center container-navbar">
        <Navbar.Brand as={Link} to="/" onClick={closeMenu} className="d-flex align-items-center">
          <img src="/BEAUTY ROOM IMMAGINE.png" className="logo" alt="Logo" />
        </Navbar.Brand>

        <Navbar.Collapse id="mainNav" className="mobile-overlay">
          <Nav className="mx-md-auto my-3 my-md-0 gap-md-4 text-center">
            {["prodotti", "trattamenti", "risultati", "chisono", "promozioni"].map(link => (
              <Nav.Link as={Link} key={link} to={`/${link}`} className="nav-link-animated" onClick={closeMenu}>
                {link.charAt(0).toUpperCase() + link.slice(1)}
              </Nav.Link>
            ))}
          </Nav>
        </Navbar.Collapse>

        <div className="navbar-center-toggle d-md-none">
          <Navbar.Toggle aria-controls="mainNav" className="shadow-none">
            <span className="navbar-toggler-icon" />
          </Navbar.Toggle>
        </div>

        <div className="nav-right ms-auto">
          <NavDropdown align="end" title={<PersonCircle size={24} color="black" />} id="navbar-user-dropdown">
            {user ? (
              <>
                <NavDropdown.Header className="text-black" style={{ fontSize: "1.05rem" }}>
                  Ciao, {user.name}!
                </NavDropdown.Header>

                <NavDropdown.Item
                  onClick={() => {
                    navigate("/mioprofilo");
                    closeMenu();
                  }}
                >
                  Il mio profilo
                </NavDropdown.Item>

                <NavDropdown.Item
                  onClick={() => {
                    navigate(user.role === "ADMIN" ? "/prenotazioni/tutte" : "/prenotazioni");
                    closeMenu();
                  }}
                >
                  {user.role === "ADMIN" ? "Visualizza prenotazioni" : "Le mie prenotazioni"}
                </NavDropdown.Item>

                <NavDropdown.Item
                  onClick={() => {
                    navigate(user.role === "ADMIN" ? "/ordini/tutti" : "/ordini");
                    closeMenu();
                  }}
                >
                  {user.role === "ADMIN" ? "Visualizza ordini" : "I miei ordini"}
                </NavDropdown.Item>

                <NavDropdown.Divider />

                <NavDropdown.Item
                  onClick={() => {
                    dispatch(logout());
                    persistor.purge();
                    closeMenu();
                  }}
                >
                  Logout
                </NavDropdown.Item>
              </>
            ) : (
              <>
                <NavDropdown.Item as={Link} to="/login" onClick={closeMenu}>
                  Accedi
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/register" onClick={closeMenu}>
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
};

export default NavBar;
