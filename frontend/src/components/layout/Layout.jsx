import { useLocation } from "react-router-dom";

export default function Layout({ children }) {
  const location = useLocation();

  const isHeroPage = location.pathname === "/";

  return (
    <>
      <Navbar />
      <main className={isHeroPage ? "has-hero" : ""}>{children}</main>
    </>
  );
}
