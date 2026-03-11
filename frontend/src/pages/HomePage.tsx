import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div>
      <section style={{
        backgroundColor: "#fff",
        padding: 32,
        borderRadius: 8,
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}>
        <h2 style={{ marginTop: 0, color: "#1565c0" }}>Welcome to BodyTrace! 👋</h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "#333" }}>
          Track your health symptoms with precision using our interactive 3D body model,
          visualize patterns over time, and gain insights into your health journey.
        </p>
      </section>

      <section>
        <h3 style={{ marginBottom: 16 }}>Get Started</h3>
        <div style={{ 
          display: "grid", 
          gap: 16, 
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" 
        }}>
          <Link to="/session" style={{ textDecoration: "none" }}>
            <div style={{ 
              border: "2px solid #1565c0",
              borderRadius: 8,
              padding: 24,
              backgroundColor: "#fff",
              cursor: "pointer",
              transition: "all 0.2s",
              height: "100%",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(21,101,192,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📍</div>
              <h4 style={{ marginTop: 0, marginBottom: 8, color: "#1565c0" }}>Track Pain</h4>
              <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
                Start a new session to mark pain locations on the 3D body model and characterize your symptoms
              </p>
            </div>
          </Link>

          <Link to="/body-map" style={{ textDecoration: "none" }}>
            <div style={{ 
              border: "2px solid #2e7d32",
              borderRadius: 8,
              padding: 24,
              backgroundColor: "#fff",
              cursor: "pointer",
              transition: "all 0.2s",
              height: "100%",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(46,125,50,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
              <h4 style={{ marginTop: 0, marginBottom: 8, color: "#2e7d32" }}>Body Map</h4>
              <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
                View all your historical pain markers with filtering by date, type, intensity, and body region
              </p>
            </div>
          </Link>

          <Link to="/timeline" style={{ textDecoration: "none" }}>
            <div style={{ 
              border: "2px solid #f57c00",
              borderRadius: 8,
              padding: 24,
              backgroundColor: "#fff",
              cursor: "pointer",
              transition: "all 0.2s",
              height: "100%",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(245,124,0,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <h4 style={{ marginTop: 0, marginBottom: 8, color: "#f57c00" }}>Timeline</h4>
              <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
                See chronological symptom progression with trends and intensity changes over time
              </p>
            </div>
          </Link>

          <Link to="/insights" style={{ textDecoration: "none" }}>
            <div style={{ 
              border: "2px solid #7b1fa2",
              borderRadius: 8,
              padding: 24,
              backgroundColor: "#fff",
              cursor: "pointer",
              transition: "all 0.2s",
              height: "100%",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(123,31,162,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💡</div>
              <h4 style={{ marginTop: 0, marginBottom: 8, color: "#7b1fa2" }}>Insights</h4>
              <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
                Get AI-generated analysis of your health patterns with trends and recommendations
              </p>
            </div>
          </Link>
        </div>
      </section>

      <section style={{
        marginTop: 32,
        padding: 24,
        backgroundColor: "#e3f2fd",
        borderRadius: 8,
        border: "1px solid #90caf9",
      }}>
        <h3 style={{ marginTop: 0, color: "#1565c0" }}>Features</h3>
        <ul style={{ lineHeight: 1.8, color: "#333" }}>
          <li>Interactive 3D body model for precise pain location tracking</li>
          <li>Comprehensive symptom characterization with follow-up questions</li>
          <li>Historical body map with advanced filtering capabilities</li>
          <li>Timeline visualization showing symptom progression</li>
          <li>AI-powered insight reports with pattern detection</li>
          <li>Full accessibility support with keyboard navigation</li>
          <li>Offline capabilities with automatic sync</li>
          <li>End-to-end encryption for data security</li>
        </ul>
      </section>
    </div>
  );
}
