import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useDispatch } from "react-redux";

import AboutSection from "./features/about/AboutSection";
import Divider from "./components/layout/Divider";
import Footer from "./components/layout/Footer";
import HeroSection from "./components/layout/HeroSection";
import ProductsPage from "./features/products/ProductsPage";
import PageTransition from "./components/common/PageTransition";
import AcademySection from "./components/layout/AcademySection";
import TestimonialsSection from "./components/layout/TestimonialsSection";
import ServicesPreview from "./features/services/ServicePreview";
import ResultsPreview from "./features/results/ResultPreview";
import ProductDetail from "./features/products/ProductDetails";
import ServicePage from "./features/services/ServicePage";
import ServiceDetail from "./features/services/ServiceDetails";
import NavBar from "./components/layout/NavBar";
import PrivateRoute from "./components/common/PrivateRoute";
import useLenis from "./hooks/useLenis";
import { logout } from "./features/auth/slices/auth.slice";
import Toaster from "./components/feedback/Toaster";
import { clearAccessToken } from "./utils/token";
import { logoutUser } from "./api/modules/auth.api";
import Map from "./components/layout/Map";
import LaserSection from "./components/laser/LaserSection";
import ScrollVelocity from "./components/common/ScrollVelocity";
import SEO from "./components/common/SEO";

const AboutDescription = lazy(() => import("./features/about/AboutDescription"));
const MyProfile = lazy(() => import("./features/profile/MyProfile"));
const BookingSuccessPage = lazy(() => import("./features/bookings/BookingSuccessPage"));
const MyArea = lazy(() => import("./pages/user/MyArea"));
const ResultsPage = lazy(() => import("./features/results/ResultsPage"));
const OccasioniPage = lazy(() => import("./features/Occasioni/OccasioniPage"));
const Login = lazy(() => import("./features/auth/Login"));
const Register = lazy(() => import("./features/auth/Register"));
const CartPage = lazy(() => import("./features/cart/CartPage"));
const OrderConfirmation = lazy(() => import("./features/orders/OrderConfirmation"));
const MyOrders = lazy(() => import("./features/orders/MyOrders"));
const AllOrders = lazy(() => import("./features/orders/AllOrders"));
const AdminAgendaPage = lazy(() => import("./components/admin/AdminAgendaPage"));
const AdminAgendaSettingsPage = lazy(() => import("./components/admin/AdminAgendaSettingsPage"));
const ImpostazioniPage = lazy(() => import("./components/admin/ImpostazioniPage"));
const ClientiPage = lazy(() => import("./pages/admin/ClientiPage"));
const ReportPage = lazy(() => import("./pages/admin/ReportPage"));
const PostItBoard = lazy(() => import("./pages/admin/PostItBoard"));
const NotifichePage = lazy(() => import("./pages/admin/NotifichePage"));
const BookingConfirmation = lazy(() => import("./features/bookings/BookingConfirmation"));
const WaitlistPage = lazy(() => import("./features/bookings/WaitlistPage"));
const PrivacyPolicy = lazy(() => import("./components/legal/PrivacyPolicy"));
const CookiePolicy = lazy(() => import("./components/legal/CookiePolicy"));
const TermsAndConditions = lazy(() => import("./components/legal/TermsAndConditions"));

// Chiavi sessionStorage usate da useScrollRestore — aggiorna se aggiungi pagine con restore
const RESTORE_KEYS = {
  "/trattamenti": "scroll_restore_service-page",
  "/prodotti": "scroll_restore_products-page",
};

function App() {
  const location = useLocation();
  const nav = useNavigate();
  const dispatch = useDispatch();

  const [toast, setToast] = useState({
    show: false,
    text: "",
    variant: "success",
  });

  useLenis();

  useEffect(() => {
    history.scrollRestoration = "manual";
  }, []);

  useEffect(() => {
    const lenis = window.__lenis;
    if (!lenis) return;

    let lastScrollHeight = document.body.scrollHeight;

    const interval = setInterval(() => {
      const currentHeight = document.body.scrollHeight;
      if (currentHeight !== lastScrollHeight) {
        lenis.resize();
        lastScrollHeight = currentHeight;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // GLOBAL AUTH UNAUTHORIZED HANDLER
  useEffect(() => {
    const onUnauthorized = () => {
      logoutUser().catch(() => {});
      clearAccessToken();
      dispatch(logout());

      setToast({
        show: true,
        variant: "warning",
        text: "Sessione scaduta. Effettua di nuovo l’accesso.",
      });

      const currentPath = location.pathname + location.search;
      nav("/login", { replace: true, state: { from: currentPath } });
    };

    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, [dispatch, nav, location.pathname, location.search]);

  // Keep-alive Railway backend (evita cold start)
  useEffect(() => {
    const BACKEND_URL = import.meta.env.VITE_API_URL || "";
    const ping = () => fetch(`${BACKEND_URL}/health`, { method: "GET" }).catch(() => {});
    ping(); // ping immediato al mount
    const id = setInterval(ping, 14 * 60 * 1000); // ogni 14 minuti
    return () => clearInterval(id);
  }, []);

  const isHeroPage = location.pathname === "/";

  const handleExitComplete = () => {
    const lenis = window.__lenis;
    if (!lenis) return;
    lenis.resize();
    const restoreKey = RESTORE_KEYS[location.pathname];
    const hasRestore = restoreKey && sessionStorage.getItem(restoreKey);
    if (!hasRestore) {
      lenis.scrollTo(0, { immediate: true });
    }
  };

  return (
    <>
      {/* Toast globale */}
      <Toaster
        show={toast.show}
        variant={toast.variant}
        text={toast.text}
        delay={3500}
        position="top-end"
        onClose={() => setToast(t => ({ ...t, show: false }))}
      />

      <NavBar />

      <main className={isHeroPage ? "has-hero" : ""}>
        <Suspense fallback={<div style={{ minHeight: "100dvh" }} />}>
          <AnimatePresence mode="wait" initial={false} onExitComplete={handleExitComplete}>
            <Routes location={location} key={location.pathname}>
              {/* HOME */}
              <Route
                path="/"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <>
                      <SEO
                        title={null}
                        description="Beauty Room di Michela: centro estetico specializzato in laser per la depilazione definitiva, trattamenti viso, estetica avanzata. Prenota online."
                      />
                      <HeroSection />
                      <LaserSection />
                      <ServicesPreview />
                      <ScrollVelocity
                        texts={["Laser · Laminazione · Permanent Make-Up · Skin Care ✦", "Risultati Reali · Professionalità · Benessere · La tua Bellezza ✦"]}
                        velocity={50}
                        damping={40}
                        stiffness={300}
                        numCopies={8}
                      />
                      <ResultsPreview />
                      <Divider />
                      <TestimonialsSection />
                      <Divider />
                      <AboutSection />
                      <Divider />
                      <AcademySection />
                      <Divider />
                      <Map />
                    </>
                  </PageTransition>
                }
              />

              {/* PUBBLICHE */}
              <Route
                path="/prodotti"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <ProductsPage />
                  </PageTransition>
                }
              />
              <Route
                path="/prodotti/:productId"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <ProductDetail />
                  </PageTransition>
                }
              />
              <Route
                path="/trattamenti"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <ServicePage />
                  </PageTransition>
                }
              />
              <Route
                path="/trattamenti/:serviceId"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <ServiceDetail />
                  </PageTransition>
                }
              />

              {/* CHI SONO */}
              <Route
                path="/chisono"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <>
                      <AboutDescription />
                      <Divider />
                      <Map />
                    </>
                  </PageTransition>
                }
              />

              <Route
                path="/risultati"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <ResultsPage />
                  </PageTransition>
                }
              />
              <Route
                path="/occasioni"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <OccasioniPage />
                  </PageTransition>
                }
              />
              <Route
                path="/login"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <Login />
                  </PageTransition>
                }
              />
              <Route
                path="/register"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <Register />
                  </PageTransition>
                }
              />
              <Route
                path="/carrello"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <CartPage />
                  </PageTransition>
                }
              />
              <Route
                path="/ordine-confermato"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <OrderConfirmation />
                  </PageTransition>
                }
              />
              <Route
                path="/prenotazione-confermata"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <BookingConfirmation />
                  </PageTransition>
                }
              />
              <Route
                path="/prenotazione/waitlist"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <WaitlistPage />
                  </PageTransition>
                }
              />
              <Route
                path="/privacy"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <PrivacyPolicy />
                  </PageTransition>
                }
              />
              <Route
                path="/cookie"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <CookiePolicy />
                  </PageTransition>
                }
              />
              <Route
                path="/termini"
                element={
                  <PageTransition routeKey={location.pathname}>
                    <TermsAndConditions />
                  </PageTransition>
                }
              />

              {/* PROTETTE - UTENTE */}
              <Route
                path="/profilo"
                element={
                  <PrivateRoute>
                    <PageTransition routeKey={location.pathname}>
                      <MyProfile />
                    </PageTransition>
                  </PrivateRoute>
                }
              />

              <Route
                path="/profilo/admin/agenda"
                element={
                  <PrivateRoute roles={["ADMIN"]}>
                    <AdminAgendaPage />
                  </PrivateRoute>
                }
              />

              <Route
                path="/profilo/admin/agenda-settings"
                element={
                  <PrivateRoute roles={["ADMIN"]}>
                    <AdminAgendaSettingsPage />
                  </PrivateRoute>
                }
              />

              <Route
                path="/admin/clienti"
                element={
                  <PrivateRoute roles={["ADMIN"]}>
                    <ClientiPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/impostazioni"
                element={
                  <PrivateRoute roles={["ADMIN"]}>
                    <ImpostazioniPage />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin/report"
                element={
                  <PrivateRoute roles={["ADMIN"]}>
                    <ReportPage />
                  </PrivateRoute>
                }
              />

              <Route
                path="/admin/post-it"
                element={
                  <PrivateRoute roles={["ADMIN"]}>
                    <PageTransition routeKey={location.pathname}>
                      <PostItBoard />
                    </PageTransition>
                  </PrivateRoute>
                }
              />

              <Route
                path="/admin/notifiche"
                element={
                  <PrivateRoute roles={["ADMIN"]}>
                    <PageTransition routeKey={location.pathname}>
                      <NotifichePage />
                    </PageTransition>
                  </PrivateRoute>
                }
              />

              <Route
                path="/ordini"
                element={
                  <PrivateRoute>
                    <PageTransition routeKey={location.pathname}>
                      <MyOrders />
                    </PageTransition>
                  </PrivateRoute>
                }
              />

              <Route
                path="/area-personale"
                element={
                  <PrivateRoute>
                    <PageTransition routeKey={location.pathname}>
                      <MyArea />
                    </PageTransition>
                  </PrivateRoute>
                }
              />

              {/* PROTETTE - ADMIN */}
              <Route
                path="/ordini/tutti"
                element={
                  <PrivateRoute roles={["ADMIN"]}>
                    <PageTransition routeKey={location.pathname}>
                      <AllOrders />
                    </PageTransition>
                  </PrivateRoute>
                }
              />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

export default App;
