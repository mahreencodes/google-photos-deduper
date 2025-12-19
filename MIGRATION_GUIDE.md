# Google Photos API Migration Guide (2025)

## 🚨 Critical Changes - Effective March 31, 2025

### API Changes Summary
Google Photos Library API has removed the following scopes:
- ❌ `photoslibrary.readonly` - Can no longer read entire library via API
- ❌ `photoslibrary` - Full access scope removed
- ❌ `photoslibrary.sharing` - Sharing functionality removed

**Remaining scopes:**
- ✅ `photoslibrary.appendonly` - Upload only
- ✅ `photoslibrary.readonly.appcreateddata` - Read app-created content only
- ✅ `photoslibrary.edit.appcreateddata` - Edit app-created content only

**New Addition:**
- 🆕 **Google Photos Picker API** - For secure photo selection

### Impact on Deduper App
The app can no longer automatically scan the entire user library via API. We need an alternative approach.

## 🔄 Migration Strategy

### Approach 1: Enhanced Chrome Extension (Recommended)
Since the Chrome extension already handles deletion, we'll enhance it to also handle photo discovery.

**Advantages:**
- Can access ALL photos in user's library
- No API limitations
- Works with existing Google Photos web interface
- Seamless user experience

**How it works:**
1. Extension injects into Google Photos web app
2. Scrolls and discovers all photos (mimics user behavior)
3. Extracts photo metadata (URLs, timestamps, dimensions)
4. Sends data to local backend for duplicate analysis
5. Displays results in beautiful UI
6. Handles deletion through web interface

### Approach 2: Google Photos Picker API (Alternative)
For users who prefer API-based approach with manual selection.

**How it works:**
1. User clicks "Select Photos to Scan"
2. Picker API opens native Google Photos selector
3. User selects batches of photos to check
4. Backend analyzes selected photos for duplicates
5. Results shown in UI

**Limitation:** Can't automatically scan entire library - requires manual selection.

## 📋 Required Changes

### 1. Backend Changes (Python/Flask)

**File: `app/config.py`**
```python
# Update OAuth scopes
SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    # Removed: 'https://www.googleapis.com/auth/photoslibrary.readonly',
    # Only needed if we want to upload markers
    # 'https://www.googleapis.com/auth/photoslibrary.appendonly',
]
```

**New API Endpoints:**
- `POST /api/extension/photos` - Receive photo data from extension
- `POST /api/extension/analyze` - Trigger analysis on extension data
- `GET /api/extension/status` - Get analysis status
- `POST /api/picker/photos` - Handle Picker API selections

### 2. Chrome Extension Changes

**New Features:**
- Photo discovery through DOM scraping
- Batch photo metadata extraction
- Direct communication with local backend
- Progress tracking and UI updates

**Files to create:**
- `extension/content-script.js` - Main scraping logic
- `extension/background.js` - Background processing
- `extension/popup.html` - Extension UI
- `extension/manifest.json` - Extension configuration

### 3. Frontend Changes

**New Components:**
- `PickerIntegration.tsx` - Google Photos Picker integration
- `ExtensionStatus.tsx` - Extension connection status
- `ScanModeSelector.tsx` - Choose between Extension/Picker mode

**Updated Components:**
- `ActiveTaskPage.tsx` - Support both scan modes
- `HomePage.tsx` - Show extension installation status

### 4. Google Cloud Console Configuration

#### Remove Old OAuth Consent Screen Scopes
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "OAuth consent screen"
3. Remove these scopes:
   - `https://www.googleapis.com/auth/photoslibrary.readonly`
   - `https://www.googleapis.com/auth/photoslibrary`
   - `https://www.googleapis.com/auth/photoslibrary.sharing`

#### Add Google Photos Picker API (if using Picker approach)
1. Go to "APIs & Services" > "Library"
2. Search for "Google Photos Picker API"
3. Enable the API
4. Add to OAuth consent screen:
   - `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`

#### Update Authorized Origins
Add extension origin:
```
chrome-extension://YOUR_EXTENSION_ID
```

## 🎨 Enhanced UI/UX Features

### 1. Scan Mode Selection
Beautiful modal to choose scanning method:
- **🔌 Extension Mode** (Recommended) - "Scan your entire library automatically"
- **🖼️ Picker Mode** - "Manually select photos to scan"

### 2. Extension Installation Flow
If extension not detected:
- Show beautiful installation guide with animations
- Step-by-step instructions
- Visual indicators showing progress

### 3. Real-time Progress
- Live photo discovery counter
- Animated progress bars
- Estimated time remaining
- Photos per second metric
- Beautiful visualizations

### 4. Duplicate Results
- Side-by-side photo comparison
- Similarity percentage
- File size comparison
- Date comparison
- One-click deletion with animation

## 🔐 Security & Privacy

### Extension Approach
- ✅ All processing done locally
- ✅ No data sent to external servers
- ✅ User data never leaves their machine
- ✅ Extension open source for transparency

### Picker API Approach
- ✅ Google-controlled selection UI
- ✅ User explicitly selects photos
- ✅ No access to unselected photos
- ✅ Follows Google's security model

## 📊 Performance Optimizations

### Extension Scanning
- Batch processing (100 photos at a time)
- Lazy loading as user scrolls
- Efficient DOM querying
- Web Workers for image analysis
- IndexedDB for caching

### Backend Processing
- Parallel image processing
- GPU acceleration for embeddings
- Efficient similarity algorithms
- Memory-optimized chunking
- Progress checkpointing

## 🚀 Migration Steps

1. **Update Backend** (15 min)
   - Update `config.py` scopes
   - Add new API endpoints
   - Test with mock data

2. **Build Chrome Extension** (2 hours)
   - Create manifest
   - Implement content script
   - Add communication layer
   - Test on Google Photos

3. **Update Frontend** (1 hour)
   - Add scan mode selector
   - Add extension status component
   - Update progress tracking
   - Integrate Picker API

4. **Update Google Cloud** (10 min)
   - Remove old scopes
   - Add Picker API (if using)
   - Update authorized origins

5. **Test End-to-End** (30 min)
   - Test extension mode
   - Test picker mode
   - Verify duplicate detection
   - Test deletion flow

6. **Deploy & Document** (30 min)
   - Update README
   - Create user guide
   - Package extension
   - Deploy backend

## 📚 Additional Resources

- [Google Photos Picker API Documentation](https://developers.google.com/photos/picker/guides)
- [Chrome Extension Development Guide](https://developer.chrome.com/docs/extensions/)
- [Google Photos Web Scraping Best Practices](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)

## ⚠️ Important Notes

1. **Timeline:** Changes take effect **March 31, 2025**
2. **Testing:** Test thoroughly before deadline
3. **User Communication:** Notify users of changes and new installation requirements
4. **Backup Plan:** Maintain old code until migration is stable
5. **Extension Store:** Submit to Chrome Web Store for easy installation

## 🎯 Success Metrics

- ✅ Can discover 100% of user's photos
- ✅ Duplicate detection accuracy > 95%
- ✅ Scanning speed > 100 photos/second
- ✅ UI responsiveness < 100ms
- ✅ Memory usage < 500MB during scan
- ✅ User satisfaction score > 4.5/5

---

**Last Updated:** December 19, 2024  
**Migration Deadline:** March 31, 2025  
**Status:** 🚧 In Progress

