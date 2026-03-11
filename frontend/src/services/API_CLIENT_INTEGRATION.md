# API Client Integration Guide

This document describes how the frontend components are integrated with the backend API through the API client service.

## Overview

The API client (`api-client.ts`) provides a centralized service for all backend communication with:
- Error handling (HTTP status codes, network errors)
- Offline detection and fallback to offline cache
- Automatic authentication token management
- Type-safe request/response handling

## Architecture

```
Frontend Components
       ↓
  API Client
       ↓
  REST API (Backend)
       ↓
  Database
```

### Offline Support

```
Frontend Components
       ↓
  API Client → [Online?] → Yes → REST API
       ↓                ↘
       ↓                 No → IndexedDB Cache
       ↓
  Connectivity Restored → Sync Cache → REST API
```

## API Client Setup

### Initialization

The API client is initialized in `App.tsx`:

```typescript
import { createApiClient, setupOfflineSyncListener } from "./services/api-client";

// Initialize API client
const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  authToken: undefined, // Set after authentication
});

// Setup offline sync listener
setupOfflineSyncListener(apiClient);
```

### Usage in Components

```typescript
import { getApiClient, ApiError, OfflineError } from "../services/api-client";

// Get the singleton instance
const apiClient = getApiClient();

// Make API calls
try {
  const session = await apiClient.createSession("user-id");
} catch (error) {
  if (error instanceof OfflineError) {
    // Handle offline state
  } else if (error instanceof ApiError) {
    // Handle API errors (4xx, 5xx)
  }
}
```

## Available API Methods

### Pain Session Methods

```typescript
// Create a new session
const session = await apiClient.createSession(userId: string);

// Get a session by ID
const session = await apiClient.getSession(sessionId: string);

// Save/update a session
await apiClient.saveSession(sessionId: string);

// Add a marker to a session
await apiClient.addMarker(sessionId: string, marker: PainMarker);

// Add a descriptor to a session
await apiClient.addDescriptor(sessionId: string, descriptor: SymptomDescriptor);
```

### Body Map Methods

```typescript
// Get complete body map for a user
const bodyMap = await apiClient.getBodyMap(userId: string);

// Filter body map markers
const result = await apiClient.filterBodyMap(userId: string, filters: MarkerFilter);
// Returns: { markers: PainMarker[], count: number }

// Get markers for a specific region
const result = await apiClient.getMarkersByRegion(userId: string, region: AnatomicalRegion);
// Returns: { region: AnatomicalRegion, markers: PainMarker[], count: number }
```

### Timeline Methods

```typescript
// Get timeline data for a region
const timeline = await apiClient.getTimeline(userId: string, region: AnatomicalRegion);
// Returns: { region, entries, trend, entryCount }
```

### Insight Report Methods

```typescript
// Generate an insight report
const report = await apiClient.generateInsightReport(userId: string);

// Export report as PDF
const blob = await apiClient.exportReportPDF(userId: string);
```

### Follow-Up Question Methods

```typescript
// Generate follow-up questions
const result = await apiClient.generateFollowUpQuestions(
  descriptor: SymptomDescriptor,
  userId?: string
);
// Returns: { questions: FollowUpQuestion[], count: number }

// Get default questions
const result = await apiClient.getDefaultQuestions();
```

### Data Deletion Methods

```typescript
// Request data deletion
const result = await apiClient.requestDataDeletion(userId: string);
// Returns: { message: string, requestId: string }

// Verify deletion status
const status = await apiClient.verifyDataDeletion(userId: string, requestId: string);
// Returns: { status: string, completedAt?: Date }
```

### Offline Sync

```typescript
// Manually trigger sync (usually automatic on connectivity restore)
const result = await apiClient.syncOfflineCache();
// Returns: { synced: string[], failed: string[], conflicts: string[] }
```

## Component Integration Examples

### BodyModelRenderer + CharacterizationPanel

See `PainSessionExample.tsx` for a complete example showing:
1. Creating a session
2. Adding markers when user clicks on body model
3. Characterizing pain with descriptors
4. Generating follow-up questions
5. Saving the session

Key integration points:
```typescript
// Handle point selection
const handlePointSelect = async (location: AnatomicalLocation) => {
  const marker: PainMarker = { /* ... */ };
  await apiClient.addMarker(sessionId, marker);
  setCurrentMarker(marker);
};

// Handle characterization completion
const handleCharacterizationComplete = async (descriptor: SymptomDescriptor) => {
  await apiClient.addDescriptor(sessionId, descriptor);
  const result = await apiClient.generateFollowUpQuestions(descriptor, userId);
  setFollowUpQuestions(result.questions);
};
```

### BodyMapView

See `BodyMapViewExample.tsx` for a complete example showing:
1. Loading body map data
2. Filtering markers by criteria
3. Displaying filtered results

Key integration points:
```typescript
// Load body map
useEffect(() => {
  const bodyMap = await apiClient.getBodyMap(userId);
  setMarkers(bodyMap.markers);
  setDescriptors(bodyMap.descriptors);
}, []);

// Handle filter changes
const handleFilterChange = async (filters: MarkerFilter) => {
  const result = await apiClient.filterBodyMap(userId, filters);
  setMarkers(result.markers);
};
```

### TimelineView

See `TimelineViewExample.tsx` for a complete example showing:
1. Loading timeline data for a region
2. Displaying chronological entries
3. Showing trends

Key integration points:
```typescript
// Load timeline
useEffect(() => {
  const data = await apiClient.getTimeline(userId, region);
  setTimelineData(data);
}, [region]);
```

### InsightReportView

See `InsightReportViewExample.tsx` for a complete example showing:
1. Generating insight reports
2. Exporting reports as PDF
3. Displaying patterns, trends, and intensity changes

Key integration points:
```typescript
// Generate report
const handleGenerateReport = async () => {
  const report = await apiClient.generateInsightReport(userId);
  setReport(report);
};

// Export PDF
const handleExportPDF = async () => {
  const blob = await apiClient.exportReportPDF(userId);
  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "report.pdf";
  link.click();
};
```

## Error Handling

### Error Types

1. **ApiError**: HTTP errors (4xx, 5xx)
   - Contains `statusCode` and `response` properties
   - Examples: 401 Unauthorized, 404 Not Found, 500 Internal Server Error

2. **OfflineError**: Network unavailable
   - Thrown when `navigator.onLine` is false
   - Thrown when fetch fails with network error

### Error Handling Pattern

```typescript
try {
  const result = await apiClient.someMethod();
  // Handle success
} catch (error) {
  if (error instanceof OfflineError) {
    // Show offline message
    setError("You are offline. Changes will sync when connection is restored.");
    setOfflineMode(true);
  } else if (error instanceof ApiError) {
    // Show API error
    setError(`API Error: ${error.message}`);
    if (error.statusCode === 401) {
      // Redirect to login
    }
  } else {
    // Unknown error
    setError("An unexpected error occurred");
  }
}
```

## Offline Behavior

### Session Creation
- **Online**: Creates session on server
- **Offline**: Creates session locally, caches in IndexedDB, syncs when online

### Marker/Descriptor Addition
- **Online**: Adds to server immediately
- **Offline**: Throws OfflineError (requires session to exist on server)

### Data Retrieval
- **Online**: Fetches from server
- **Offline**: Throws OfflineError (no local cache for read operations)

### Sync on Connectivity Restore
When connectivity is restored:
1. `online` event fires
2. `syncOfflineCache()` is called automatically
3. Cached sessions are uploaded to server
4. Conflicts are resolved (server data wins)
5. User is notified of sync results

## Loading States and User Feedback

### Recommended UI States

1. **Loading**: Show spinner or skeleton while API call is in progress
2. **Error**: Display error message with retry option
3. **Offline**: Show offline indicator, explain sync behavior
4. **Success**: Provide confirmation feedback

### Example Loading State

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleAction = async () => {
  setLoading(true);
  setError(null);
  try {
    await apiClient.someMethod();
  } catch (error) {
    setError(handleError(error));
  } finally {
    setLoading(false);
  }
};

return (
  <div>
    {loading && <Spinner />}
    {error && <ErrorMessage message={error} />}
    <button onClick={handleAction} disabled={loading}>
      Action
    </button>
  </div>
);
```

## Authentication

### Setting Auth Token

```typescript
const apiClient = getApiClient();
apiClient.setAuthToken("your-jwt-token");
```

### Handling 401 Unauthorized

```typescript
catch (error) {
  if (error instanceof ApiError && error.statusCode === 401) {
    // Clear auth token
    apiClient.setAuthToken(undefined);
    // Redirect to login
    navigate("/login");
  }
}
```

## Testing

### Unit Tests

See `api-client.test.ts` for comprehensive test coverage:
- All API methods
- Error handling (404, 401, 500)
- Offline detection
- Offline fallback behavior
- Authentication headers

### Integration Tests

Example components demonstrate real-world integration patterns:
- `PainSessionExample.tsx`
- `BodyMapViewExample.tsx`
- `TimelineViewExample.tsx`
- `InsightReportViewExample.tsx`

## Environment Configuration

Set the API base URL in `.env`:

```
VITE_API_BASE_URL=http://localhost:3000
```

For production:

```
VITE_API_BASE_URL=https://api.bodytrace.com
```

## Requirements Validation

This integration validates the following requirements:

- **Requirement 8.5**: Offline cache sync trigger on connectivity restore ✓
- **Requirement 5.2**: Body map retrieval and filtering ✓
- **Requirement 6.1**: Timeline data retrieval ✓
- **Requirement 7.1**: Insight report generation ✓
- **Requirement 7.4**: PDF export ✓
- **Requirement 4.1**: Follow-up question generation ✓
- **Requirement 9.3**: Authentication on all endpoints ✓

## Next Steps

1. Implement actual authentication flow (login, token management)
2. Add retry logic with exponential backoff for failed requests
3. Implement request caching for frequently accessed data
4. Add request cancellation for component unmount
5. Implement optimistic UI updates for better UX
