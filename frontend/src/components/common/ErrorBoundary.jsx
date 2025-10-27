import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container-base flex-column text-center py-5">
          <h2 className="fw-bold text-danger mb-3">Oops! Qualcosa è andato storto 😢</h2>
          <p className="text-muted">Riprova a ricaricare la pagina o torna alla home.</p>
          <button className="btn btn-outline-primary mt-3" onClick={() => window.location.reload()}>
            Ricarica la pagina
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
