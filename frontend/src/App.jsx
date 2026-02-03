import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import AboutSection from "./features/about/AboutSection";
import Divider from "./components/layout/Divider";
import Footer from "./components/layout/Footer";
import HeroSection from "./components/layout/HeroSection";
import ProductsPage from "./features/products/ProductsPage";
import AboutDescription from "./features/about/AboutDescription";
import MyProfile from "./features/profile/MyProfile";
import BookingSuccessPage from "./features/bookings/BookingSuccessPage";
import AllBookings from "./features/bookings/AllBookings";
import ResultsPage from "./features/results/ResultsPage";
import ScrollToTop from "./components/common/ScrollToTop";
import PageTransition from "./components/common/PageTransition";
import AcademySection from "./components/layout/AcademySection";
import TestimonialsSection from "./components/layout/TestimonialsSection";
import ServicesPreview from "./features/services/ServicePreview";
import ResultsPreview from "./features/results/ResultPreview";
import ProductDetail from "./features/products/ProductDetails";
import ServicePage from "./features/services/ServicePage";
import ServiceDetail from "./features/services/ServiceDetails";
import PromotionsPage from "./features/promotions/PromotionsPage";
import Login from "./features/auth/Login";
import Register from "./features/auth/Register";
import CartPage from "./features/cart/CartPage";
import OrderConfirmation from "./features/orders/OrderConfirmation";
import MyOrders from "./features/orders/MyOrders";
import MyBookings from "./features/bookings/MyBookings";
import AllOrders from "./features/orders/AllOrders";
import NavBar from "./components/layout/NavBar";
import PrivateRoute from "./components/common/PrivateRoute";
import useLenis from "./hooks/useLenis";
import { useEffect, useState } from "react";
import AdminAgendaSettingsPage from "./components/admin/AdminAgendaSettingsPage";
import AdminAgendaPage from "./components/admin/AdminAgendaPage";
import { useDispatch } from "react-redux";
import { logout } from "./features/auth/slices/auth.slice";
import Toaster from "./components/feedback/Toaster";
import { clearToken } from "./utils/token";
import Map from "./components/layout/Map";
import BookingConfirmation from "./features/bookings/BookingConfirmation";
import PrivacyPolicy from "./components/legal/PrivacyPolicy";
import CookiePolicy from "./components/legal/CookiePolicy";
import TermsAndConditions from "./components/legal/TermsAndConditions";
import LaserSection from "./components/laser/LaserSection";

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
    const lenis = window.__lenis;
    if (!lenis) return;

    const refreshLenis = () => {
      lenis.resize();
      lenis.scrollTo(0, { immediate: true });
    };

    refreshLenis();
    const id1 = setTimeout(refreshLenis, 400);
    const id2 = setTimeout(refreshLenis, 1000);

    return () => {
      clearTimeout(id1);
      clearTimeout(id2);
    };
  }, [location.pathname]);

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
      clearToken();
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

  const isHeroPage = location.pathname === "/";

  useEffect(() => {
    const lenis = window.__lenis;
    if (!lenis) return;

    const observer = new ResizeObserver(() => {
      lenis.resize();
    });

    observer.observe(document.body);

    return () => observer.disconnect();
  }, []);

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

      <ScrollToTop />
      <NavBar />

      <main className={isHeroPage ? "has-hero" : ""}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            {/* HOME */}
            <Route
              path="/"
              element={
                <PageTransition routeKey={location.pathname}>
                  <>
                    <HeroSection />
                    <LaserSection />
                    <ServicesPreview />
                    <Divider />
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
              path="/promozioni"
              element={
                <PageTransition routeKey={location.pathname}>
                  <PromotionsPage />
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
              path="/prenotazioni"
              element={
                <PrivateRoute>
                  <PageTransition routeKey={location.pathname}>
                    <MyBookings />
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

            <Route
              path="/prenotazioni/tutte"
              element={
                <PrivateRoute roles={["ADMIN"]}>
                  <PageTransition routeKey={location.pathname}>
                    <AllBookings />
                  </PageTransition>
                </PrivateRoute>
              }
            />
          </Routes>
        </AnimatePresence>
      </main>
      <Footer />
    </>
  );
}

export default App;
