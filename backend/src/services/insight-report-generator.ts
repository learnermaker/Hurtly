import { randomUUID } from "crypto";
import type {
  BodyMap,
  InsightReport,
  SymptomPattern,
  FrequencyTrend,
  IntensityChange,
  PainMarker,
  Trend,
  PainType,
} from "../../../shared/src/types";

/**
 * InsightReportGenerator
 * 
 * Generates actionable insight reports from body map data, including:
 * - Symptom patterns (co-occurring regions/pain types)
 * - Frequency trends for each region
 * - Intensity changes over time
 * - PDF export functionality
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */
export class InsightReportGenerator {
  private readonly DISCLAIMER =
    "This report is informational and does not constitute medical advice.";
  private readonly MIN_DATA_POINTS_FOR_TREND = 3;
  private readonly DAYS_FOR_INTENSITY_CHANGE = 7;

  /**
   * Generate an insight report from body map data
   * Validates: Requirements 7.1, 7.2, 7.5
   */
  generate(bodyMap: BodyMap): InsightReport {
    const patterns = this.identifyPatterns(bodyMap);
    const frequencyTrends = this.computeFrequencyTrends(bodyMap);
    const intensityChanges = this.computeIntensityChanges(bodyMap);

    return {
      id: randomUUID(),
      userId: bodyMap.userId,
      generatedAt: new Date(),
      patterns,
      frequencyTrends,
      intensityChanges,
      disclaimer: this.DISCLAIMER,
    };
  }

  /**
   * Export report to PDF format
   * Validates: Requirements 7.4
   */
  async exportPDF(report: InsightReport): Promise<Buffer> {
    // Using pdfkit for PDF generation
    const PDFDocument = (await import("pdfkit")).default;
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Title
      doc.fontSize(20).text("BodyTrace Insight Report", { align: "center" });
      doc.moveDown();

      // Generated date
      doc
        .fontSize(10)
        .text(`Generated: ${report.generatedAt.toLocaleDateString()}`, {
          align: "center",
        });
      doc.moveDown(2);

      // Symptom Patterns
      doc.fontSize(16).text("Symptom Patterns");
      doc.moveDown();
      if (report.patterns.length === 0) {
        doc.fontSize(12).text("No patterns identified.");
      } else {
        report.patterns.forEach((pattern, index) => {
          doc
            .fontSize(12)
            .text(`${index + 1}. ${pattern.description}`, { indent: 20 });
          doc
            .fontSize(10)
            .text(`   Regions: ${pattern.regions.join(", ")}`, { indent: 30 });
          doc
            .fontSize(10)
            .text(`   Pain Types: ${pattern.painTypes.join(", ")}`, {
              indent: 30,
            });
          doc.moveDown();
        });
      }
      doc.moveDown();

      // Frequency Trends
      doc.fontSize(16).text("Frequency Trends");
      doc.moveDown();
      if (report.frequencyTrends.length === 0) {
        doc.fontSize(12).text("No frequency trends identified.");
      } else {
        report.frequencyTrends.forEach((trend) => {
          doc
            .fontSize(12)
            .text(
              `${trend.region}: ${trend.trend} (${trend.dataPoints} data points)`,
              { indent: 20 }
            );
        });
      }
      doc.moveDown(2);

      // Intensity Changes
      doc.fontSize(16).text("Intensity Changes");
      doc.moveDown();
      if (report.intensityChanges.length === 0) {
        doc.fontSize(12).text("No significant intensity changes identified.");
      } else {
        report.intensityChanges.forEach((change) => {
          const direction =
            change.toIntensity > change.fromIntensity
              ? "increased"
              : "decreased";
          doc
            .fontSize(12)
            .text(
              `${change.region}: ${direction} from ${change.fromIntensity} to ${change.toIntensity}`,
              { indent: 20 }
            );
          doc
            .fontSize(10)
            .text(
              `   Period: ${change.period.start.toLocaleDateString()} - ${change.period.end.toLocaleDateString()}`,
              { indent: 30 }
            );
          doc.moveDown();
        });
      }
      doc.moveDown(2);

      // Disclaimer
      doc
        .fontSize(10)
        .fillColor("gray")
        .text(report.disclaimer, { align: "center" });

      doc.end();
    });
  }

  /**
   * Identify symptom patterns (co-occurring regions and pain types)
   * Validates: Requirements 7.2
   */
  private identifyPatterns(bodyMap: BodyMap): SymptomPattern[] {
    const patterns: SymptomPattern[] = [];

    // Group markers by session to find co-occurring symptoms
    const sessionGroups = new Map<string, PainMarker[]>();
    for (const marker of bodyMap.markers) {
      const existing = sessionGroups.get(marker.sessionId) || [];
      existing.push(marker);
      sessionGroups.set(marker.sessionId, existing);
    }

    // Find sessions with multiple markers (co-occurring symptoms)
    for (const [sessionId, markers] of sessionGroups) {
      if (markers.length > 1) {
        const regions = markers.map((m) => m.location.region.name);
        const painTypes = markers
          .map((m) => {
            const descriptor = bodyMap.descriptors.find(
              (d) => d.markerId === m.id
            );
            return descriptor?.painType;
          })
          .filter((pt): pt is PainType => pt !== undefined);

        if (painTypes.length > 0) {
          const description = this.generatePatternDescription(
            regions,
            painTypes
          );
          patterns.push({ regions, painTypes, description });
        }
      }
    }

    return patterns;
  }

  /**
   * Generate plain-language description for a symptom pattern
   */
  private generatePatternDescription(
    regions: string[],
    painTypes: PainType[]
  ): string {
    const uniqueRegions = [...new Set(regions)];
    const uniquePainTypes = [...new Set(painTypes)];

    if (uniqueRegions.length === 1) {
      return `${uniquePainTypes.join(" and ")} pain in ${uniqueRegions[0]}`;
    }

    return `${uniquePainTypes.join(" and ")} pain across ${uniqueRegions.join(", ")}`;
  }

  /**
   * Compute frequency trends for each region with sufficient data
   * Validates: Requirements 7.2
   */
  private computeFrequencyTrends(bodyMap: BodyMap): FrequencyTrend[] {
    const trends: FrequencyTrend[] = [];

    // Group markers by region
    const regionGroups = new Map<string, PainMarker[]>();
    for (const marker of bodyMap.markers) {
      const regionName = marker.location.region.name;
      const existing = regionGroups.get(regionName) || [];
      existing.push(marker);
      regionGroups.set(regionName, existing);
    }

    // Compute trend for each region with sufficient data
    for (const [region, markers] of regionGroups) {
      if (markers.length >= this.MIN_DATA_POINTS_FOR_TREND) {
        const sortedMarkers = markers.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );

        // Count occurrences over time to determine frequency trend
        const trend = this.determineTrend(sortedMarkers);

        trends.push({
          region,
          trend,
          dataPoints: markers.length,
        });
      }
    }

    return trends;
  }

  /**
   * Determine trend based on marker frequency over time
   */
  private determineTrend(sortedMarkers: PainMarker[]): Trend {
    if (sortedMarkers.length < this.MIN_DATA_POINTS_FOR_TREND) {
      return "stable";
    }

    // Split markers into first half and second half
    const midpoint = Math.floor(sortedMarkers.length / 2);
    const firstHalf = sortedMarkers.slice(0, midpoint);
    const secondHalf = sortedMarkers.slice(midpoint);

    // Calculate average time between markers in each half
    const firstHalfInterval = this.calculateAverageInterval(firstHalf);
    const secondHalfInterval = this.calculateAverageInterval(secondHalf);

    // If intervals are decreasing, frequency is increasing (worsening)
    // If intervals are increasing, frequency is decreasing (improving)
    const changeRatio = secondHalfInterval / firstHalfInterval;

    if (changeRatio < 0.8) {
      return "worsening"; // Frequency increasing
    } else if (changeRatio > 1.2) {
      return "improving"; // Frequency decreasing
    } else {
      return "stable";
    }
  }

  /**
   * Calculate average time interval between markers
   */
  private calculateAverageInterval(markers: PainMarker[]): number {
    if (markers.length < 2) {
      return Infinity;
    }

    let totalInterval = 0;
    for (let i = 1; i < markers.length; i++) {
      totalInterval +=
        markers[i].createdAt.getTime() - markers[i - 1].createdAt.getTime();
    }

    return totalInterval / (markers.length - 1);
  }

  /**
   * Compute intensity changes over time for each region
   * Validates: Requirements 7.2
   */
  private computeIntensityChanges(bodyMap: BodyMap): IntensityChange[] {
    const changes: IntensityChange[] = [];

    // Group markers by region
    const regionGroups = new Map<string, PainMarker[]>();
    for (const marker of bodyMap.markers) {
      const regionName = marker.location.region.name;
      const existing = regionGroups.get(regionName) || [];
      existing.push(marker);
      regionGroups.set(regionName, existing);
    }

    // Find intensity changes for each region
    for (const [region, markers] of regionGroups) {
      const sortedMarkers = markers.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      // Look for significant changes over the defined period
      for (let i = 0; i < sortedMarkers.length - 1; i++) {
        const startMarker = sortedMarkers[i];
        const endMarker = sortedMarkers[sortedMarkers.length - 1];

        const daysDiff =
          (endMarker.createdAt.getTime() - startMarker.createdAt.getTime()) /
          (1000 * 60 * 60 * 24);

        if (daysDiff >= this.DAYS_FOR_INTENSITY_CHANGE) {
          const intensityDiff = Math.abs(
            endMarker.intensity - startMarker.intensity
          );

          // Only report significant changes (>= 2 points)
          if (intensityDiff >= 2) {
            changes.push({
              region,
              fromIntensity: startMarker.intensity,
              toIntensity: endMarker.intensity,
              period: {
                start: startMarker.createdAt,
                end: endMarker.createdAt,
              },
            });
            break; // Only report one change per region
          }
        }
      }
    }

    return changes;
  }
}
