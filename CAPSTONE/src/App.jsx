import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import "./App.css";

import AboutSection from "./components/AboutSection";
import Divider from "./components/Divider";
import Footer from "./components/Footer";
import HeroSection from "./components/HeroSection";
import NavBar from "./components/NavBar";
import ServicePreview from "./components/ServicePreview";
import ProductsPage from "./components/ProductsPage";
import ProductDetails from "./components/ProductDetails";
import AboutDescription from "./components/AboutDescription";
import ServiceDetail from "./components/ServiceDetails";
import ServicePage from "./components/ServicePage";
import Register from "./components/Register";
import Login from "./components/Login";
import CartPage from "./components/CartPage";
import OrderSuccessPage from "./components/OrderSuccessPage";
import AllOrders from "./components/AllOrders";
import MyProfile from "./components/MyProfile";
import BookingSuccessPage from "./components/BookingSuccessPage";
import AllBookings from "./components/AllBookings";
import MyBookings from "./components/MyBookings";
import MyOrders from "./components/MyOrders";
import ResultsPage from "./components/ResultsPage";
import ScrollToTop from "./components/ScrollToTop";
import PageTransition from "./components/PageTransition";
import AcademySection from "./components/AcademySection";
import TestimonialsSection from "./components/TestimonialsSection";
import ResultsPreview from "./components/ResultPreview";

function App() {
  const location = useLocation();

  return (
    <>
      <ScrollToTop />
      <NavBar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <PageTransition>
                <>
                  <HeroSection />
                  <ServicePreview />
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
                <ProductDetails />
              </PageTransition>
            }
          />
          <Route
            path="/ordini"
            element={
              <PageTransition>
                <MyOrders />
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
                <OrderSuccessPage />
              </PageTransition>
            }
          />
          <Route
            path="/ordini/tutti"
            element={
              <PageTransition>
                <AllOrders />
              </PageTransition>
            }
          />
          <Route
            path="/mioprofilo"
            element={
              <PageTransition>
                <MyProfile />
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
            path="/prenotazione-confermata"
            element={
              <PageTransition>
                <BookingSuccessPage />
              </PageTransition>
            }
          />
          <Route
            path="/prenotazioni"
            element={
              <PageTransition>
                <MyBookings />
              </PageTransition>
            }
          />
          <Route
            path="/prenotazioni/tutte"
            element={
              <PageTransition>
                <AllBookings />
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
        </Routes>
      </AnimatePresence>
      <Footer />
    </>
  );
}

export default App;
