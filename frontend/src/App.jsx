import { Route, Routes, useLocation } from "react-router-dom";
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
import { useEffect } from "react";
import AdminAgendaSettingsPage from "./components/admin/AdminAgendaSettingsPage";
import AdminAgendaPage from "./components/admin/AdminAgendaPage";

function App() {
  const location = useLocation();

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
                    <ServicesPreview />
                    <Divider />
                    <ResultsPreview />
                    <Divider />
                    <TestimonialsSection />
                    <Divider />
                    <AboutSection />
                    <Divider />
                    <AcademySection />
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
            <Route
              path="/chisono"
              element={
                <PageTransition routeKey={location.pathname}>
                  <AboutDescription />
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
                  <BookingSuccessPage />
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
