# Lick Library Frontend - Implementation Guide

## Overview

The Lick Library frontend provides two main features:
1. **Lick Community** - Browse and discover public licks from the community
2. **My Licks** - Manage your personal lick library

## 🎯 Features Implemented

### 1. Lick Community (UC-11)
- ✅ Browse public licks with infinite scroll
- ✅ Search licks by title/description
- ✅ Filter licks by tags
- ✅ Sort by newest or most popular
- ✅ Real-time waveform visualization
- ✅ Click to view lick details
- ✅ Pagination controls

### 2. My Licks (Personal Library)
- ✅ View all your uploaded licks
- ✅ Search your personal library
- ✅ Filter by tags and status (draft/active/inactive)
- ✅ Edit and delete lick actions
- ✅ Status badges (draft, active, inactive)
- ✅ Privacy indicators (public/private)
- ✅ Upload new lick button

## 📁 File Structure

```
fe/src/
├── App.js                           # Main app with routing and header
├── layouts/
│   └── LickLibraryLayout.js        # Layout with sidebar navigation
├── pages/
│   └── user/
│       ├── LickCommunity/
│       │   ├── index.js
│       │   └── LickCommunityPage.js # Community browse page
│       └── MyLicks/
│           ├── index.js
│           └── MyLicksPage.js       # Personal library page
└── ... (other files)
```

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd fe
npm install
```

Required dependencies:
- `react-router-dom` (routing) ✅ Installed
- `axios` (API calls) ✅ Installed
- `react-icons` (icons) ✅ Installed
- `tailwindcss` (styling) - Check if configured

### 2. Start Development Server

```bash
npm start
```

The app will open at `http://localhost:3000`

### 3. Backend Setup

Ensure the backend is running:
```bash
cd ../be
npm run dev
```

Backend should be at `http://localhost:9999`

## 🎨 Component Structure

### LickCard Component (Community)

Displays a lick in the community browse view:
- Title, creator, date
- Likes count
- Duration and difficulty badges
- **Waveform visualization**
- Tags
- Hover effects and click navigation

### MyLickCard Component (Personal Library)

Extends LickCard with additional features:
- Status badge (draft/active/inactive)
- Privacy badge (public/private)
- Edit and Delete buttons (show on hover)
- All stats (likes, comments, duration)

### Layout Components

**LickLibraryLayout:**
- Sidebar navigation (My Licks / Lick Community)
- Main content area
- Auto-highlights active route

**Header:**
- Global navigation
- Search bar
- Notifications and messages
- User avatar
- LiveStream and Create buttons

## 🎵 Waveform Visualization

The waveform is rendered using the `waveform_data` array from the API:

```javascript
{waveform_data && waveform_data.length > 0 ? (
  <div className="flex items-center justify-center h-full px-4">
    <div className="flex items-center justify-center space-x-0.5 h-full w-full">
      {waveform_data.map((amplitude, index) => (
        <div
          key={index}
          className="bg-orange-300 w-1 transition-all"
          style={{
            height: `${Math.max(amplitude * 100, 2)}%`,
            opacity: 0.7 + amplitude * 0.3,
          }}
        />
      ))}
    </div>
  </div>
) : (
  <div>No waveform data</div>
)}
```

- Each bar represents amplitude at that time point
- Height = amplitude (0-1) * 100%
- Opacity varies with amplitude for depth effect
- 200 samples displayed

## 🔌 API Integration

### API Base URL

```javascript
const API_BASE = 'http://localhost:9999/api';
```

### Lick Community API

**Endpoint:** `GET /api/licks/community`

**Parameters:**
```javascript
{
  search: string,    // Search term
  tags: string,      // Comma-separated tags
  sortBy: string,    // 'newest' | 'popular'
  page: number,      // Page number
  limit: number      // Items per page (default: 20)
}
```

**Usage:**
```javascript
const response = await axios.get('http://localhost:9999/api/licks/community', {
  params: {
    search: 'blues',
    tags: 'Blues,Guitar',
    sortBy: 'popular',
    page: 1,
    limit: 20
  }
});
```

### My Licks API

**Endpoint:** `GET /api/licks/user/:userId`

**Parameters:**
```javascript
{
  search: string,    // Search term
  tags: string,      // Comma-separated tags
  status: string,    // 'draft' | 'active' | 'inactive'
  page: number,      // Page number
  limit: number      // Items per page
}
```

**Usage:**
```javascript
const userId = '507f1f77bcf86cd799439011'; // From auth
const response = await axios.get(`http://localhost:9999/api/licks/user/${userId}`, {
  params: {
    status: 'draft',
    search: 'solo',
    page: 1
  }
});
```

## 🎯 API Response Structure

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "lick_id": "68ff1356f74fafd5612eeeac",
      "title": "Blues Lick in A Minor",
      "description": "A classic blues lick...",
      "audio_url": "https://res.cloudinary.com/...",
      "waveform_data": [0.05, 0.12, 0.45, ...],  // 200 samples
      "duration": 15.661859,
      "tab_notation": "e|---12---15...",
      "key": "A minor",
      "tempo": 120,
      "difficulty": "intermediate",
      "status": "active",                // Only in My Licks
      "is_public": true,                 // Only in My Licks
      "is_featured": false,
      "creator": {
        "user_id": "507f...",
        "display_name": "John Doe",
        "avatar_url": "https://..."
      },
      "tags": [
        {
          "tag_id": "...",
          "tag_name": "Blues",
          "tag_type": "genre"
        }
      ],
      "likes_count": 42,
      "comments_count": 7,              // Only in My Licks
      "created_at": "2025-10-27T06:38:14.353Z",
      "updated_at": "2025-10-27T06:38:14.353Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## 🎭 State Management

### Component State

Each page manages its own state:

```javascript
const [licks, setLicks] = useState([]);           // Lick list
const [loading, setLoading] = useState(true);     // Loading state
const [error, setError] = useState(null);         // Error message
const [searchTerm, setSearchTerm] = useState(''); // Search input
const [selectedTags, setSelectedTags] = useState(''); // Tags filter
const [sortBy, setSortBy] = useState('newest');   // Sort option
const [page, setPage] = useState(1);              // Current page
const [pagination, setPagination] = useState(null); // Pagination info
```

### Effect Hooks

**Fetch on Filter Change:**
```javascript
useEffect(() => {
  fetchLicks();
}, [page, sortBy, statusFilter]);
```

**Search Debounce:**
```javascript
useEffect(() => {
  const timer = setTimeout(() => {
    if (page === 1) {
      fetchLicks();
    } else {
      setPage(1); // Reset to page 1
    }
  }, 500); // 500ms debounce

  return () => clearTimeout(timer);
}, [searchTerm, selectedTags]);
```

## 🎨 Styling Guide

### Color Scheme

```css
/* Background */
bg-gray-950 - App background
bg-gray-900 - Card background
bg-gray-800 - Input background

/* Borders */
border-gray-800 - Default border
border-gray-700 - Hover border
border-orange-500 - Active border

/* Text */
text-white - Primary text
text-gray-400 - Secondary text
text-orange-400 - Accent text

/* Buttons */
bg-gradient-to-r from-orange-500 to-red-600 - Primary action
bg-gray-800 hover:bg-gray-700 - Secondary action
bg-red-600 - Delete action
bg-blue-600 - Edit action
```

### Status Colors

```css
/* Difficulty */
beginner: bg-green-900 text-green-300
intermediate: bg-yellow-900 text-yellow-300
advanced: bg-red-900 text-red-300

/* Status */
active: bg-green-900 text-green-300
draft: bg-yellow-900 text-yellow-300
inactive: bg-gray-800 text-gray-400
```

## 📱 Responsive Design

The UI is responsive using Tailwind CSS:

```jsx
// Toolbar layout
<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
  // Stacks vertically on mobile, horizontal on desktop
</div>

// Search input
<div className="relative flex-1 min-w-[200px]">
  // Flexible width with minimum
</div>
```

## 🔧 Customization

### Change Items Per Page

```javascript
const [limit] = useState(20); // Change to 10, 30, etc.
```

### Add More Sort Options

```javascript
<select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
  <option value="newest">Newest First</option>
  <option value="popular">Most Popular</option>
  <option value="trending">Trending</option>  {/* Add this */}
</select>
```

### Customize Waveform Colors

```javascript
<div
  className="bg-orange-300 w-1" // Change color here
  style={{
    height: `${Math.max(amplitude * 100, 2)}%`,
    opacity: 0.7 + amplitude * 0.3, // Adjust opacity
  }}
/>
```

## 🐛 Error Handling

### Loading State
```javascript
{loading && (
  <div className="flex items-center justify-center py-20">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
  </div>
)}
```

### Error State
```javascript
{error && (
  <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
    <p className="text-red-400">{error}</p>
    <button onClick={fetchLicks}>Try again</button>
  </div>
)}
```

### Empty State
```javascript
{licks.length === 0 && (
  <div className="text-center py-20">
    <p className="text-xl font-semibold">No licks found</p>
    <p className="text-sm mt-2">Try adjusting your search or filters</p>
  </div>
)}
```

## 🔗 Navigation

### Routing Structure

```
/                           → Redirects to /library/community
/library/
  ├─ /community            → Lick Community page
  └─ /my-licks             → My Licks page
```

### Navigation Methods

```javascript
// Using React Router
navigate('/library/community');

// Using window.location (for full reload)
window.location.href = '/lick/123';
```

## 🚀 Next Steps / TODO

### Features to Implement

- [ ] Lick Detail Page (`/lick/:id`)
- [ ] Lick Upload Page (`/lick/upload`)
- [ ] Lick Edit Page (`/lick/edit/:id`)
- [ ] Delete API integration
- [ ] Audio playback controls
- [ ] Like/Unlike functionality
- [ ] Comments section
- [ ] User authentication integration
- [ ] Playlist management
- [ ] Advanced filters (difficulty, key, tempo)

### Improvements

- [ ] Add loading skeletons instead of spinner
- [ ] Implement virtualized list for better performance
- [ ] Add keyboard shortcuts
- [ ] Add drag-and-drop for upload
- [ ] Cache API responses
- [ ] Add toast notifications
- [ ] Implement real-time updates with WebSockets

## 🧪 Testing

### Manual Testing Checklist

**Lick Community:**
- [ ] Page loads successfully
- [ ] Licks display correctly
- [ ] Waveforms render
- [ ] Search works with debounce
- [ ] Tag filtering works
- [ ] Sort dropdown changes order
- [ ] Pagination buttons work
- [ ] Click lick card navigates
- [ ] Empty state shows when no results
- [ ] Error state shows on API failure

**My Licks:**
- [ ] Page loads user's licks
- [ ] Status filter works
- [ ] Edit button shows on hover
- [ ] Delete button shows on hover
- [ ] Delete confirmation appears
- [ ] Upload button navigates
- [ ] Empty state shows for new users
- [ ] Search filters personal library

## 📞 Support

For issues or questions:
1. Check browser console for errors
2. Verify backend is running on port 9999
3. Check API response in Network tab
4. Review component state in React DevTools

## 📚 Additional Resources

- [React Router Documentation](https://reactrouter.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Axios Documentation](https://axios-http.com/)
- [React Icons](https://react-icons.github.io/react-icons/)

---

**Status**: ✅ Implementation Complete
**Last Updated**: 2025-10-27
**Version**: 1.0.0








