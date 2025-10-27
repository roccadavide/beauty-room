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

function App() {
  useLenis();
  const location = useLocation();

  return (
    <>
      <ScrollToTop />
      <NavBar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* HOME */}
          <Route
            path="/"
            element={
              <PageTransition>
                <>
                  <HeroSection />
                  <ServicesPreview />
                  <Divider />
                  <AboutSection />
                  <Divider />
                  <AcademySection />
                  <Divider />
                  <TestimonialsSection />
                  <Divider />
                  <ResultsPreview />
                </>
              </PageTransition>
            }
          />

          {/* PUBBLICHE */}
          <Route
            path="/prodotti"
            element={
              <PageTransition>
                <ProductsPage />
              </PageTransition>
            }
          />
          <Route
            path="/prodotti/:productId"
            element={
              <PageTransition>
                <ProductDetail />
              </PageTransition>
            }
          />
          <Route
            path="/trattamenti"
            element={
              <PageTransition>
                <ServicePage />
              </PageTransition>
            }
          />
          <Route
            path="/trattamenti/:serviceId"
            element={
              <PageTransition>
                <ServiceDetail />
              </PageTransition>
            }
          />
          <Route
            path="/chisono"
            element={
              <PageTransition>
                <AboutDescription />
              </PageTransition>
            }
          />
          <Route
            path="/risultati"
            element={
              <PageTransition>
                <ResultsPage />
              </PageTransition>
            }
          />
          <Route
            path="/promozioni"
            element={
              <PageTransition>
                <PromotionsPage />
              </PageTransition>
            }
          />
          <Route
            path="/login"
            element={
              <PageTransition>
                <Login />
              </PageTransition>
            }
          />
          <Route
            path="/register"
            element={
              <PageTransition>
                <Register />
              </PageTransition>
            }
          />
          <Route
            path="/carrello"
            element={
              <PageTransition>
                <CartPage />
              </PageTransition>
            }
          />
          <Route
            path="/ordine-confermato"
            element={
              <PageTransition>
                <OrderConfirmation />
              </PageTransition>
            }
          />
          <Route
            path="/prenotazione-confermata"
            element={
              <PageTransition>
                <BookingSuccessPage />
              </PageTransition>
            }
          />

          {/* PROTETTE - UTENTE */}
          <Route
            path="/mioprofilo"
            element={
              <PrivateRoute>
                <PageTransition>
                  <MyProfile />
                </PageTransition>
              </PrivateRoute>
            }
          />

          <Route
            path="/ordini"
            element={
              <PrivateRoute>
                <PageTransition>
                  <MyOrders />
                </PageTransition>
              </PrivateRoute>
            }
          />

          <Route
            path="/prenotazioni"
            element={
              <PrivateRoute>
                <PageTransition>
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
                <PageTransition>
                  <AllOrders />
                </PageTransition>
              </PrivateRoute>
            }
          />

          <Route
            path="/prenotazioni/tutte"
            element={
              <PrivateRoute roles={["ADMIN"]}>
                <PageTransition>
                  <AllBookings />
                </PageTransition>
              </PrivateRoute>
            }
          />
        </Routes>
      </AnimatePresence>
      <Footer />
    </>
  );
}

export default App;
