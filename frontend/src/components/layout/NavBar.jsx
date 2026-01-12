import { useEffect, useRef, useState, useCallback } from "react";
import { Container, Nav, Navbar, NavDropdown, Modal, Button } from "react-bootstrap";
import { PersonCircle, ChevronDown, ChevronUp, BoxArrowRight } from "react-bootstrap-icons";
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
  const [mobileProfileExpanded, setMobileProfileExpanded] = useState(false);

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const drawerRef = useRef(null);
  const togglerRef = useRef(null);

  const { user, isLoading } = useSelector(s => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // Performance
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const isScrolled = window.scrollY > 20;
          setScrolled(prev => (prev !== isScrolled ? isScrolled : prev));
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Blocco scroll pagina
  useEffect(() => {
    if (expanded) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100dvh";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, [expanded]);

  // Accessibilità
  useEffect(() => {
    const handleEscape = e => {
      if (e.key === "Escape" && expanded) {
        setExpanded(false);
        togglerRef.current?.focus();
      }
    };
    if (expanded) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [expanded]);

  useEffect(() => {
    if (!expanded || !drawerRef.current) return;
    const drawer = drawerRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleTabTrap = e => {
      if (e.key !== "Tab") return;
      const focusableElements = drawer.querySelectorAll(focusableSelector);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    drawer.addEventListener("keydown", handleTabTrap);
    setTimeout(() => drawer.querySelector(focusableSelector)?.focus(), 50);
    return () => drawer.removeEventListener("keydown", handleTabTrap);
  }, [expanded]);

  // Callbacks
  const handleTogglerKeyPress = useCallback(e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setExpanded(prev => !prev);
    }
  }, []);

  const handleUserToggleKeyPress = useCallback(e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setMobileProfileExpanded(prev => !prev);
    }
  }, []);

  useEffect(() => {
    setExpanded(false);
    setMobileProfileExpanded(false);
  }, [location.pathname]);

  const closeMenu = useCallback(() => setExpanded(false), []);

  // Logout Modal
  const handleLogoutClick = () => {
    setShowLogoutModal(true);
    closeMenu();
  };

  // Logout
  const confirmLogout = () => {
    dispatch(logout());
    persistor.purge();
    navigate("/");
    setShowLogoutModal(false);
  };

  return (
    <>
      <Navbar expand="lg" fixed="top" expanded={expanded} className={`beauty-nav ${scrolled ? "nav-scrolled" : "nav-transparent"}`}>
        <Container fluid className="px-3 px-md-4 align-items-center">
          <Navbar.Brand as={Link} to="/" onClick={closeMenu} className="brand-logo">
            <img src="/logo.png" alt="Beauty Room" width="150" height="104" fetchPriority="high" decoding="sync" />
          </Navbar.Brand>

          <div className="toggler-cart-box d-lg-none ms-auto d-flex align-items-center gap-3">
            <Link to="/carrello" className="mobile-cart-icon-sm" aria-label="Carrello">
              <CartIcon />
            </Link>

            <button
              type="button"
              ref={togglerRef}
              className={`beauty-toggler ${expanded ? "open" : ""}`}
              onClick={() => setExpanded(!expanded)}
              onKeyDown={handleTogglerKeyPress}
              aria-label={expanded ? "Chiudi menu" : "Apri menu"}
              aria-expanded={expanded}
              aria-controls="mobile-drawer"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>

          <Navbar.Collapse className="d-none d-lg-flex flex-grow-1 justify-content-center">
            <Nav className="nav-links">
              {LINKS.map(({ to, label }) => (
                <Nav.Link key={to} as={NavLink} to={to} className="beauty-link">
                  {label}
                </Nav.Link>
              ))}
            </Nav>
          </Navbar.Collapse>

          <div className="d-none d-lg-flex align-items-center gap-3 nav-icons-right">
            <Link to="/carrello" className="desktop-cart-btn me-3">
              <CartIcon />
            </Link>

            <NavDropdown
              align="end"
              title={isLoading ? <div className="user-skeleton-loader"></div> : <PersonCircle size={30} />}
              className="beauty-dropdown"
              aria-haspopup="menu"
              aria-label="Menu utente"
              disabled={isLoading}
            >
              {user ? (
                <>
                  <div className="dropdown-header-custom">Ciao, {user.name}</div>
                  <NavDropdown.Item as={Link} to="/profilo">
                    Il mio profilo
                  </NavDropdown.Item>
                  <NavDropdown.Item as={Link} to={user.role === "ADMIN" ? "/prenotazioni/tutte" : "/prenotazioni"}>
                    {user.role === "ADMIN" ? "Gestione Prenotazioni" : "Le mie prenotazioni"}
                  </NavDropdown.Item>
                  <NavDropdown.Item as={Link} to={user.role === "ADMIN" ? "/ordini/tutti" : "/ordini"}>
                    {user.role === "ADMIN" ? "Gestione Ordini" : "I miei ordini"}
                  </NavDropdown.Item>
                  <NavDropdown.Item as={Link} to={"/profilo/admin/agenda"}>
                    {user.role === "ADMIN" ? "Agenda" : ""}
                  </NavDropdown.Item>
                  <NavDropdown.Divider />
                  <NavDropdown.Item onClick={handleLogoutClick} className="text-danger">
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
          </div>
        </Container>
      </Navbar>

      <div className={`mobile-overlay ${expanded ? "show" : ""}`} onClick={closeMenu} />

      <div
        ref={drawerRef}
        id="mobile-drawer"
        className={`mobile-drawer ${expanded ? "open" : ""}`}
        role="navigation"
        aria-label="Menu mobile"
        aria-hidden={!expanded}
      >
        <div className="drawer-scroll-wrapper">
          <div className="spacer-top"></div>

          <nav className="mobile-nav-list">
            {LINKS.map(({ to, label }, index) => (
              <NavLink
                key={to}
                to={to}
                onClick={closeMenu}
                className="mobile-link-elegant"
                style={{ animationDelay: `${index * 0.08}s` }}
                tabIndex={expanded ? 0 : -1}
              >
                <span className="deco-bar"></span>
                <span className="link-text">{label}</span>
              </NavLink>
            ))}
          </nav>

          <hr className="drawer-divider" />

          <div className="mobile-user-section">
            {isLoading ? (
              <div className="d-flex justify-content-center py-4">
                <div className="user-skeleton-loader"></div>
              </div>
            ) : user ? (
              <div className="mobile-logged-in">
                <div
                  className="user-toggle"
                  onClick={() => setMobileProfileExpanded(!mobileProfileExpanded)}
                  onKeyDown={handleUserToggleKeyPress}
                  role="button"
                  tabIndex={expanded ? 0 : -1}
                  aria-expanded={mobileProfileExpanded}
                  aria-haspopup="menu"
                  aria-label="Menu profilo utente"
                >
                  <div className="d-flex align-items-center gap-2">
                    <PersonCircle size={24} className="gold-icon" />
                    <span className="fw-bold">Ciao, {user.name}</span>
                  </div>
                  {mobileProfileExpanded ? <ChevronUp /> : <ChevronDown />}
                </div>

                <div className={`user-submenu ${mobileProfileExpanded ? "expanded" : ""}`}>
                  <Link to="/mioprofilo" onClick={closeMenu} tabIndex={mobileProfileExpanded ? 0 : -1}>
                    Il mio profilo
                  </Link>
                  <Link to={user.role === "ADMIN" ? "/prenotazioni/tutte" : "/prenotazioni"} onClick={closeMenu} tabIndex={mobileProfileExpanded ? 0 : -1}>
                    {user.role === "ADMIN" ? "Gestione Prenotazioni" : "Le mie prenotazioni"}
                  </Link>
                  <Link to={user.role === "ADMIN" ? "/ordini/tutti" : "/ordini"} onClick={closeMenu} tabIndex={mobileProfileExpanded ? 0 : -1}>
                    {user.role === "ADMIN" ? "Gestione Ordini" : "I miei ordini"}
                  </Link>
                  <button type="button" onClick={handleLogoutClick} className="logout-btn-mobile" tabIndex={mobileProfileExpanded ? 0 : -1}>
                    Esci
                  </button>
                </div>
              </div>
            ) : (
              <div className="mobile-auth-buttons">
                <Link to="/login" onClick={closeMenu} className="btn-auth-mobile login" tabIndex={expanded ? 0 : -1}>
                  Accedi
                </Link>
                <Link to="/register" onClick={closeMenu} className="btn-auth-mobile register" tabIndex={expanded ? 0 : -1}>
                  Registrati
                </Link>
              </div>
            )}
          </div>

          <div className="mobile-footer-action">
            <Link to="/carrello" onClick={closeMenu} className="btn-cart-mobile" tabIndex={expanded ? 0 : -1}>
              <span className="me-2">Vai al Carrello</span> <CartIcon />
            </Link>
          </div>

          <div className="spacer-bottom"></div>
        </div>
      </div>

      <Modal show={showLogoutModal} onHide={() => setShowLogoutModal(false)} centered className="beauty-modal">
        <Modal.Header closeButton>
          <Modal.Title className="font-titles">Conferma Uscita</Modal.Title>
        </Modal.Header>
        <Modal.Body>Sei sicuro/a di voler effettuare il logout?</Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="link" className="text-muted text-decoration-none" onClick={() => setShowLogoutModal(false)}>
            Annulla
          </Button>
          <Button type="button" variant="dark" className="btn-gold" onClick={confirmLogout}>
            <BoxArrowRight />
            <p className="mb-0">Sì, esci</p>
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
