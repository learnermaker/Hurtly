import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { createApiClient, setupOfflineSyncListener } from "./services/api-client";
import PainSessionPage from "./pages/PainSessionPage";
import BodyMapPage from "./pages/BodyMapPage";
import TimelinePage from "./pages/TimelinePage";
import InsightsPage from "./pages/InsightsPage";
import HomePage from "./pages/HomePage";

function Navigation() {
  const location = useLocation();
  
  const navItems = [
    { path: "/", label: "Home", icon: "🏠" },
    { path: "/session", label: "Track Pain", icon: "📍" },
    { path: "/body-map", label: "Body Map", icon: "🗺️" },
    { path: "/timeline", label: "Timeline", icon: "📊" },
    { path: "/insights", label: "Insights", icon: "💡" },
  ];

  return (
    <nav style={{
      backgroundColor: "#1565c0",
      padding: "0 20px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    }}>
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        gap: 8,
      }}>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            style={{
              padding: "16px 20px",
              color: location.pathname === item.path ? "#fff" : "rgba(255,255,255,0.8)",
              textDecoration: "none",
              borderBottom: location.pathname === item.path ? "3px solid #fff" : "3px solid transparent",
              fontWeight: location.pathname === item.path ? 600 : 400,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function AppContent() {
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    // Initialize API client
    const apiClient = createApiClient({
      baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001",
      authToken: "user-123e4567-e89b-12d3-a456-426614174000", // Demo user UUID
    });

    setupOfflineSyncListener(apiClient);
    console.log("API client initialized");
    setApiReady(true);
  }, []);

  if (!apiReady) {
    return (
      <div style={{ 
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: "#1565c0" }}>Loading BodyTrace...</h2>
          <p style={{ color: "#666" }}>Initializing application</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: "system-ui, sans-serif",
      minHeight: "100vh",
      backgroundColor: "#f5f5f5",
    }}>
      <header style={{ 
        backgroundColor: "#fff",
        borderBottom: "1px solid #e0e0e0",
        padding: "16px 20px",
      }}>
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <h1 style={{ margin: 0, color: "#1565c0", fontSize: 28 }}>BodyTrace</h1>
            <p style={{ margin: "4px 0 0", color: "#666", fontSize: 14 }}>
              Interactive health intelligence platform
            </p>
          </div>
          <div style={{ fontSize: 12, color: "#999" }}>
            v0.1.0
          </div>
        </div>
      </header>

      <Navigation />

      <main style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: 20,
      }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/session" element={<PainSessionPage />} />
          <Route path="/body-map" element={<BodyMapPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/insights" element={<InsightsPage />} />
        </Routes>
      </main>

      <footer style={{
        marginTop: 48,
        padding: "24px 20px",
        borderTop: "1px solid #e0e0e0",
        textAlign: "center",
        color: "#666",
        fontSize: 14,
        backgroundColor: "#fff",
      }}>
        <p style={{ margin: 0 }}>
          BodyTrace © 2024 | Built with React + TypeScript + Three.js
        </p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
