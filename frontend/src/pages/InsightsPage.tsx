import InsightReportView from "../components/InsightReportView";
import { DEMO_USER_ID } from "../config/constants";

export default function InsightsPage() {
  return (
    <div>
      <div style={{
        backgroundColor: "#fff",
        padding: 24,
        borderRadius: 8,
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}>
        <h2 style={{ marginTop: 0, color: "#7b1fa2" }}>Health Insights</h2>
        <p style={{ color: "#666", marginBottom: 0 }}>
          AI-generated analysis of your health patterns with trends and recommendations.
        </p>
      </div>

      <div style={{
        backgroundColor: "#fff",
        padding: 24,
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}>
        <InsightReportView userId={DEMO_USER_ID} />
      </div>
    </div>
  );
}
