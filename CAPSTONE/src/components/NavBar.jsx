import { useEffect, useState } from "react";
import { Container, Nav, Navbar, NavDropdown } from "react-bootstrap";
import { PersonCircle } from "react-bootstrap-icons";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../redux/action/authActions";
import CartIcon from "./CartIcon";

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
    <Navbar expand="md" fixed="top" expanded={expanded} onToggle={setExpanded} className={scrolled ? "navbar-solid" : "navbar-gradient"}>
      <Container fluid className="px-3 position-relative d-flex align-items-center container-navbar">
        <Navbar.Brand as={Link} to="/" onClick={closeMenu} className="d-flex align-items-center">
          <img src="/BEAUTY ROOM IMMAGINE.png" className="logo" alt="Logo" />
        </Navbar.Brand>

        <Navbar.Collapse id="mainNav" className="mobile-overlay">
          <Nav className="mx-md-auto my-3 my-md-0 gap-md-4">
            <Nav.Link as={Link} to="/prodotti" className="nav-link-animated text-center" onClick={closeMenu}>
              Prodotti
            </Nav.Link>
            <Nav.Link as={Link} to="/trattamenti" className="nav-link-animated text-center" onClick={closeMenu}>
              Trattamenti
            </Nav.Link>
            <Nav.Link as={Link} to="/risultati" className="nav-link-animated text-center" onClick={closeMenu}>
              Risultati
            </Nav.Link>
            <Nav.Link as={Link} to="/chisono" className="nav-link-animated text-center" onClick={closeMenu}>
              Chi sono
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>

        <div className="navbar-center-toggle d-md-none">
          <Navbar.Toggle aria-controls="mainNav" className="shadow-none">
            <span className="navbar-toggler-icon" />
          </Navbar.Toggle>
        </div>

        <div className="nav-right d-flex align-items-center gap-4 ms-auto" style={{ zIndex: 1040 }}>
          {user ? (
            <>
              <NavDropdown align="end" title={<PersonCircle size={24} color="black" />} id="navbar-profile-dropdown">
                <NavDropdown.Header className="text-black" style={{ fontSize: "1.05rem" }}>
                  Ciao, {user.name}!
                </NavDropdown.Header>

                {user.role === "ADMIN" ? (
                  <>
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
                        navigate("/prenotazioni/tutte");
                        closeMenu();
                      }}
                    >
                      Visualizza prenotazioni
                    </NavDropdown.Item>
                    <NavDropdown.Item
                      onClick={() => {
                        navigate("/ordini/tutti");
                        closeMenu();
                      }}
                    >
                      Visualizza ordini
                    </NavDropdown.Item>
                  </>
                ) : (
                  <>
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
                        navigate("/prenotazioni");
                        closeMenu();
                      }}
                    >
                      Le mie prenotazioni
                    </NavDropdown.Item>
                    <NavDropdown.Item
                      onClick={() => {
                        navigate("/ordini");
                        closeMenu();
                      }}
                    >
                      I miei ordini
                    </NavDropdown.Item>
                  </>
                )}

                <NavDropdown.Divider />
                <NavDropdown.Item
                  onClick={() => {
                    dispatch(logout());
                    closeMenu();
                  }}
                >
                  Logout
                </NavDropdown.Item>
              </NavDropdown>
              <CartIcon />
            </>
          ) : (
            <>
              <NavDropdown align="end" title={<PersonCircle size={24} color="black" />} id="navbar-auth-dropdown">
                <NavDropdown.Item as={Link} to="/login" onClick={closeMenu}>
                  Accedi
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/register" onClick={closeMenu}>
                  Registrati
                </NavDropdown.Item>
              </NavDropdown>
              <CartIcon />
            </>
          )}
        </div>
      </Container>
    </Navbar>
  );
};

export default NavBar;
