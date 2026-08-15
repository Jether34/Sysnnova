import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", textAlign: "center", color: "#dc2626" }}>
          <h2>Something went wrong</h2>
          <details style={{ textAlign: "left", maxWidth: "600px", margin: "0 auto" }}>
            <summary>Error Details</summary>
            <pre style={{ 
              background: "#fef2f2", 
              padding: "10px", 
              overflow: "auto", 
              textAlign: "left",
              fontSize: "12px"
            }}>
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{ 
              marginTop: "16px", 
              padding: "8px 16px", 
              background: "#2563eb", 
              color: "white", 
              border: "none", 
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}